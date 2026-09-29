// Netlify scheduled function: runs hourly and asks the app to send gift reminders
// and near-funeral alerts. Set CRON_SECRET (16+ random characters) in Netlify.
const giftReminders = async () => {
  const base = process.env.URL;
  const secret = process.env.CRON_SECRET;
  if (!base || !secret) return new Response('not configured', { status: 503 });
  const res = await fetch(`${base}/api/cron/gift-reminders`, { headers: { Authorization: `Bearer ${secret}` } });
  return new Response(await res.text(), { status: res.status });
};

export default giftReminders;

export const config = { schedule: '@hourly' };
