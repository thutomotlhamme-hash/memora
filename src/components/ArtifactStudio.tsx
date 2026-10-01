'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { useOrigin } from '@/lib/hooks';
import * as A from '@/lib/artifacts';
import { displayName, type Draft } from '@/lib/memorial';
import type { ThumbKind } from '@/lib/artifacts';
import { KeepsakeThumb } from './KeepsakeThumb';
import { useToast } from './Toast';

type Item = {
  key: ThumbKind;
  kind: string;
  title: string;
  body: string;
  action: string;
  run: (input: A.ArtifactInput) => Promise<void>;
  dark?: boolean;
};

const ITEMS: Item[] = [
  {
    key: 'announcement',
    kind: 'WhatsApp · 1080 × 1350',
    title: 'Announcement',
    body: 'A gentle death notice to send first, with the service time and the memorial link.',
    action: 'Download PNG',
    run: A.announcementCard,
    dark: true,
  },
  {
    key: 'social',
    kind: 'Square · 1080 × 1080',
    title: 'Memorial card',
    body: 'Portrait, name and dates for WhatsApp Status, Instagram and family groups.',
    action: 'Download PNG',
    run: A.socialCard,
  },
  {
    key: 'journey',
    kind: 'WhatsApp · 1080 × 1350',
    title: 'Funeral journey card',
    body: 'Every stop in order with times, to share once the arrangements are final.',
    action: 'Download PNG',
    run: A.journeyCard,
  },
  {
    key: 'qr',
    kind: 'Print · 4 × 5 in · 300 dpi',
    title: 'QR card',
    body: 'A framed QR code for the entrance, the guest book table or the back of the programme.',
    action: 'Download PNG',
    run: A.qrCard,
  },
  {
    key: 'programme',
    kind: 'A4 PDF',
    title: 'Printable programme',
    body: 'A cover with their portrait, the order of service with start times, the journey and a closing page with a QR code. Ready to print.',
    action: 'Download PDF',
    run: A.programmePdf,
  },
  {
    key: 'booklet',
    kind: 'A5 booklet · print at home',
    title: 'Programme booklet',
    body: 'The programme and their story as a folded A5 booklet. Print double-sided on A4, flip on the short edge, then fold in half.',
    action: 'Download PDF',
    run: A.programmeBooklet,
  },
  {
    key: 'keepsake-card',
    kind: 'Print · 5 × 7 in · 300 dpi',
    title: 'Keepsake card',
    body: 'A small card with a line from their story, to print and hand to guests.',
    action: 'Download PNG',
    run: A.keepsakeCard,
  },
  {
    key: 'keepsake',
    kind: 'A4 PDF',
    title: 'Keepsake book',
    body: 'Everything, preserved and printable: their story, the programme, the journey and the family’s words.',
    action: 'Download PDF',
    run: A.keepsakePdf,
    dark: true,
  },
];

export function ArtifactStudio({
  draft,
  slug,
  caseId,
  brand,
  privateNow = false,
}: {
  draft: Draft;
  slug: string;
  caseId: string;
  brand?: { name: string; logoUrl: string; colour: string } | null;
  /** The memorial's public year is over (or it was taken down): keepsakes still work, its link no longer opens for guests. */
  privateNow?: boolean;
}) {
  const toast = useToast();
  const prepared = useRef<Promise<A.PrintBrand | null> | null>(null);
  const origin = useOrigin();
  const [busy, setBusy] = useState('');
  const url = `${origin}/m/${slug}`;
  const name = displayName(draft.person);
  // The home's brand, ready for print (and for the QR card's thumbnail).
  const [printBrand, setPrintBrand] = useState<A.PrintBrand | null>(null);
  useEffect(() => {
    let live = true;
    prepared.current ??= A.prepareBrand(brand);
    void prepared.current.then((b) => live && setPrintBrand(b));
    return () => {
      live = false;
    };
  }, [brand]);

  return (
    <main className="container">
      <div className="page-head">
        <div>
          <span className="eyebrow">Cards, programme & keepsake</span>
          <h1 className="h1" style={{ margin: '10px 0 10px' }}>
            Everything to share, from one memorial.
          </h1>
          <p className="lede">
            Each download is made fresh from the live memorial, so a changed time or corrected name is always current.
            {brand ? ` Printed items carry ${brand.name}’s name${brand.logoUrl ? ' and logo' : ''} on the back.` : ''}
          </p>
        </div>
        <Link className="btn" href={`/memorials/${caseId}?step=publish`}>
          ← Back to memorial
        </Link>
      </div>
      {privateNow && (
        <div className="note" role="status" style={{ marginBottom: 18 }}>
          <span>
            <strong>This memorial is private now.</strong> The programme, keepsake book and cards are still yours to download and print. Its link and QR code no
            longer open for guests, so share the files themselves.
          </span>
        </div>
      )}
      <div className="artifact-grid">
        {ITEMS.map((item) => (
          <article className="artifact" key={item.key}>
            <div className={`preview ${item.dark ? 'dark' : ''}`}>
              {origin && <KeepsakeThumb kind={item.key} draft={draft} url={url} brand={printBrand} alt={`${item.title} for ${name}`} />}
            </div>
            <div className="body">
              <span className="eyebrow plain">{item.kind}</span>
              <h2 className="h3">{item.title}</h2>
              <p>{item.body}</p>
              <button
                className="btn primary"
                type="button"
                disabled={!origin || Boolean(busy)}
                onClick={async () => {
                  setBusy(item.key);
                  try {
                    prepared.current ??= A.prepareBrand(brand);
                    await item.run({ draft, url, slug, brand: await prepared.current });
                    toast(`${item.title} downloaded.`);
                  } catch (err) {
                    toast(err instanceof Error ? err.message : 'Could not create this download.', 'error');
                  }
                  setBusy('');
                }}
              >
                {busy === item.key ? 'Preparing…' : item.action}
              </button>
            </div>
          </article>
        ))}
      </div>
    </main>
  );
}
