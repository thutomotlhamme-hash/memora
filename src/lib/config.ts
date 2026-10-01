// Runtime configuration. NEXT_PUBLIC_* values are safe for the browser; everything
// else is read only on the server.

export const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
export const supabasePublishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? '';
export const MEDIA_BUCKET = 'memora-media';

/** Memora can run without Supabase: guest drafts and /m/preview still work. */
export function isSupabaseConfigured(): boolean {
  return Boolean(supabaseUrl && supabasePublishableKey);
}

export function siteUrl(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000').replace(/\/$/, '');
}

/**
 * Payments switch. Off (the default) = launch mode: publishing is free and
 * "Give a memorial" is hidden. Set NEXT_PUBLIC_MEMORA_PAYMENTS=on in Netlify and
 * redeploy to charge for publishing and sell gifts again.
 */
export const paymentsOn = process.env.NEXT_PUBLIC_MEMORA_PAYMENTS === 'on';

/** Public contact details shown in the footer, privacy policy and terms. */
export const contact = {
  /** Optional public email. Without it, the site points people to the /contact form. */
  get email(): string {
    return process.env.NEXT_PUBLIC_CONTACT_EMAIL || '';
  },
  get whatsapp(): string {
    return process.env.NEXT_PUBLIC_CONTACT_WHATSAPP || '';
  },
  get businessName(): string {
    return process.env.NEXT_PUBLIC_BUSINESS_NAME || 'Memora';
  },
};

/**
 * The supplier details South African law asks an online shop to show (ECTA s43)
 * and the Information Officer POPIA requires. Set them in Netlify; anything
 * missing is listed under Command centre → Setup.
 */
export const legal = {
  get name(): string {
    return process.env.NEXT_PUBLIC_LEGAL_NAME || '';
  },
  get registration(): string {
    return process.env.NEXT_PUBLIC_COMPANY_REG || '';
  },
  get vat(): string {
    return process.env.NEXT_PUBLIC_VAT_NUMBER || '';
  },
  get address(): string {
    return process.env.NEXT_PUBLIC_PHYSICAL_ADDRESS || '';
  },
  get informationOfficer(): string {
    return process.env.NEXT_PUBLIC_INFORMATION_OFFICER || '';
  },
};

/** The version of the terms people agree to (recorded with each agreement). Change it when the terms change. */
export const TERMS_VERSION = '2026-10-01';
