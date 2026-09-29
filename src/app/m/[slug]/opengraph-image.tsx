import { ImageResponse } from 'next/og';
import { OgCard } from '@/components/OgCard';
import { displayName, lifeDates } from '@/lib/memorial';
import { loadPublicMemorial } from '@/lib/server/cases';
import { getAdminSupabase } from '@/lib/supabase/admin';

export const alt = 'In loving memory';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

// The WhatsApp preview for a shared memorial: portrait, name and dates. Every
// share also quietly introduces Memora to the guests who receive it.
export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const admin = getAdminSupabase();
  const m = admin ? await loadPublicMemorial(admin, slug) : { state: 'not_found' as const };
  if (m.state !== 'ok') {
    return new ImageResponse(<OgCard kicker="Memorial" title="In loving memory." subtitle="Funeral details, directions and programme." />, size);
  }
  const name = displayName(m.draft.person);
  const portrait = m.draft.person.portraitUrl;
  return new ImageResponse(
    <div style={{ width: '100%', height: '100%', display: 'flex', background: '#141413', color: '#faf9f5' }}>
      {portrait ? (
        <img src={portrait} alt="" width={472} height={630} style={{ width: 472, height: 630, objectFit: 'cover' }} />
      ) : (
        <div style={{ width: 472, height: 630, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#2b2a27', fontSize: 140, color: '#b9b6ab' }}>
          {name.slice(0, 1)}
        </div>
      )}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: 64 }}>
        <div style={{ fontSize: 22, letterSpacing: 4, color: '#e08a67', textTransform: 'uppercase', fontWeight: 700 }}>In loving memory</div>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ fontSize: name.length > 22 ? 64 : 80, lineHeight: 1.02, letterSpacing: -2 }}>{name}</div>
          <div style={{ fontSize: 28, color: '#b9b6ab', marginTop: 20 }}>{lifeDates(m.draft.person)}</div>
          <div style={{ fontSize: 26, color: '#faf9f5', marginTop: 28 }}>Funeral details, directions and programme</div>
        </div>
        <div style={{ fontSize: 24, color: '#b9b6ab' }}>Memora</div>
      </div>
    </div>,
    size,
  );
}
