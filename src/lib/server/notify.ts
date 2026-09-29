import 'server-only';

// Outbound messages. Each channel is optional: when its keys are missing the send
// is skipped (and reported as not sent), so Memora keeps working and the buyer's
// thank-you page still offers a manual WhatsApp share and a copyable link.

export type SendResult = { sent: boolean; error?: string };

export function escapeHtml(v: string): string {
  return v.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/** Email via Resend (https://resend.com). Needs RESEND_API_KEY and MEMORA_FROM_EMAIL. */
export async function sendEmail(to: string | null | undefined, subject: string, html: string, text: string): Promise<SendResult> {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.MEMORA_FROM_EMAIL;
  if (!to) return { sent: false, error: 'no address' };
  if (!key || !from) return { sent: false, error: 'email not configured' };
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from, to: [to], subject, html, text, reply_to: process.env.MEMORA_TEAM_EMAIL || undefined }),
      cache: 'no-store',
    });
    if (!res.ok) return { sent: false, error: `Resend ${res.status}: ${(await res.text()).slice(0, 200)}` };
    return { sent: true };
  } catch (err) {
    return { sent: false, error: err instanceof Error ? err.message : 'email failed' };
  }
}

/**
 * WhatsApp via Meta's WhatsApp Cloud API. Businesses may only start a WhatsApp
 * conversation with a pre-approved *template*, so this sends the template named in
 * WHATSAPP_GIFT_TEMPLATE with three body variables: {{1}} recipient name,
 * {{2}} buyer name, {{3}} link. Needs WHATSAPP_TOKEN and WHATSAPP_PHONE_NUMBER_ID.
 */
export async function sendWhatsAppTemplate(toDigits: string | null | undefined, params: string[]): Promise<SendResult> {
  const token = process.env.WHATSAPP_TOKEN;
  const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const template = process.env.WHATSAPP_GIFT_TEMPLATE;
  if (!toDigits) return { sent: false, error: 'no number' };
  if (!token || !phoneId || !template) return { sent: false, error: 'whatsapp not configured' };
  try {
    const res = await fetch(`https://graph.facebook.com/v21.0/${encodeURIComponent(phoneId)}/messages`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: toDigits,
        type: 'template',
        template: {
          name: template,
          language: { code: process.env.WHATSAPP_TEMPLATE_LANGUAGE || 'en' },
          components: [{ type: 'body', parameters: params.map((text) => ({ type: 'text', text: text.slice(0, 900) })) }],
        },
      }),
      cache: 'no-store',
    });
    if (!res.ok) return { sent: false, error: `WhatsApp ${res.status}: ${(await res.text()).slice(0, 200)}` };
    return { sent: true };
  } catch (err) {
    return { sent: false, error: err instanceof Error ? err.message : 'whatsapp failed' };
  }
}

/** Plain, calm HTML email shell in Memora's colours. */
export function emailLayout(opts: { preheader: string; heading: string; paragraphs: string[]; cta?: { label: string; href: string }; footer?: string }): string {
  const p = opts.paragraphs.map((t) => `<p style="margin:0 0 16px;font-size:16px;line-height:1.6;color:#3d3d3a">${t}</p>`).join('');
  const cta = opts.cta
    ? `<p style="margin:28px 0"><a href="${escapeHtml(opts.cta.href)}" style="display:inline-block;background:#141413;color:#faf9f5;text-decoration:none;padding:14px 22px;border-radius:8px;font-weight:600;font-size:15px">${escapeHtml(opts.cta.label)}</a></p>
       <p style="margin:0 0 16px;font-size:13px;color:#66655f">Or copy this link: <br><span style="word-break:break-all">${escapeHtml(opts.cta.href)}</span></p>`
    : '';
  return `<!doctype html><html><body style="margin:0;background:#faf9f5;font-family:Inter,Segoe UI,Arial,sans-serif">
<span style="display:none;max-height:0;overflow:hidden">${escapeHtml(opts.preheader)}</span>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 16px">
<table role="presentation" width="100%" style="max-width:560px;background:#ffffff;border:1px solid #e8e6dc;border-radius:16px"><tr><td style="padding:32px">
<p style="margin:0 0 24px;font-family:Georgia,serif;font-size:22px;color:#141413">Memora</p>
<h1 style="margin:0 0 20px;font-family:Georgia,serif;font-weight:400;font-size:28px;line-height:1.2;color:#141413">${escapeHtml(opts.heading)}</h1>
${p}${cta}
<p style="margin:24px 0 0;font-size:13px;color:#66655f">${opts.footer ?? 'Memora · Remember beautifully'}</p>
</td></tr></table></td></tr></table></body></html>`;
}
