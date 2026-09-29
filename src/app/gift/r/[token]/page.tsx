import Link from 'next/link';
import { StatusScreen } from '@/components/MemorialView';
import { RedeemGift } from '@/components/RedeemGift';
import { SiteHeader } from '@/components/SiteHeader';
import { fmtDate } from '@/lib/memorial';
import { PRODUCT } from '@/lib/plans';
import { verifyGiftToken } from '@/lib/server/links';
import { getAdminSupabase } from '@/lib/supabase/admin';
import { getSessionUser } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'A gift for you', robots: { index: false } };

export default async function RedeemPage({ params }: { params: Promise<{ token: string }> }) {
  const token = decodeURIComponent((await params).token);
  const giftId = verifyGiftToken('redeem', token);
  const admin = getAdminSupabase();
  const { data: gift } =
    giftId && admin
      ? await admin.from('memora_gifts').select('status,buyer_name,recipient_name,loved_one_name,message,funeral_date_estimate,redeemed_by,case_id').eq('id', giftId).maybeSingle()
      : { data: null };

  if (!gift || gift.status === 'PENDING' || gift.status === 'CANCELLED') {
    return <StatusScreen eyebrow="Gift" title="This gift link isn’t valid." body="Please check you opened the full link from the message you received, or ask the person who sent it." />;
  }

  const user = await getSessionUser();
  if (gift.status === 'REDEEMED') {
    if (user && gift.redeemed_by === user.id && gift.case_id) {
      return (
        <StatusScreen
          eyebrow="Gift"
          title="You’ve already started this memorial."
          body="Pick up where you left off."
          action={
            <Link className="btn primary" href={`/memorials/${gift.case_id}`}>
              Open the memorial
            </Link>
          }
        />
      );
    }
    return <StatusScreen eyebrow="Gift" title="This gift has already been used." body="If you think this is a mistake, reply to the email that brought you here." />;
  }

  const next = encodeURIComponent(`/gift/r/${token}`);
  return (
    <>
      <SiteHeader />
      <main className="narrow" style={{ padding: 'clamp(40px, 7vw, 88px) 0' }}>
        <div className="gift-card">
          <span className="eyebrow">A gift for you</span>
          <h1 className="display" style={{ fontSize: 'clamp(36px, 5.5vw, 56px)', margin: '14px 0 16px' }}>
            {gift.recipient_name}, {gift.buyer_name} has taken care of this.
          </h1>
          <p style={{ color: 'var(--on-night-muted)', fontSize: 18, margin: 0 }}>
            They’ve paid for a Memora memorial{gift.loved_one_name ? ` for ${gift.loved_one_name}` : ''}: a page for their story, the funeral journey with
            directions, the programme, one QR code for everyone, and keepsakes to download. It’s yours to create, at your own pace.
          </p>
          {gift.message && (
            <blockquote>
              “{gift.message}”<cite>— {gift.buyer_name}</cite>
            </blockquote>
          )}
          {gift.funeral_date_estimate && (
            <p style={{ color: 'var(--on-night-muted)', marginTop: 20 }}>
              The funeral is expected around <strong style={{ color: 'var(--on-night)' }}>{fmtDate(gift.funeral_date_estimate)}</strong>. Starting today leaves
              plenty of time.
            </p>
          )}
          <div className="row" style={{ marginTop: 28 }}>
            {user ? (
              <RedeemGift token={token} />
            ) : (
              <>
                <Link className="btn on-night primary lg" href={`/account/register?next=${next}`}>
                  Create a free account to start
                </Link>
                <Link className="btn on-night lg" href={`/account/login?next=${next}`}>
                  I have an account
                </Link>
              </>
            )}
          </div>
          <p style={{ color: 'var(--on-night-muted)', fontSize: 14, marginTop: 18 }}>
            {PRODUCT.name} is already paid. You won’t be asked to pay. Nothing is public until you publish.
          </p>
        </div>
      </main>
    </>
  );
}
