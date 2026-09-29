'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useOrigin } from '@/lib/hooks';
import * as A from '@/lib/artifacts';
import { displayName, lifeDates, type Draft } from '@/lib/memorial';
import { QrImage } from './Share';
import { useToast } from './Toast';

type Item = {
  key: string;
  kind: string;
  title: string;
  body: string;
  action: string;
  run: (input: A.ArtifactInput) => Promise<void>;
  dark?: boolean;
  preview: (name: string, dates: string, url: string) => React.ReactNode;
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
    preview: (n, d) => (
      <div>
        <div className="k">With deep sorrow</div>
        <div className="n">{n}</div>
        <div className="d">{d}</div>
      </div>
    ),
  },
  {
    key: 'social',
    kind: 'Square · 1080 × 1080',
    title: 'Memorial card',
    body: 'Portrait, name and dates for WhatsApp Status, Instagram and family groups.',
    action: 'Download PNG',
    run: A.socialCard,
    preview: (n, d) => (
      <div>
        <div className="k">In loving memory</div>
        <div className="n">{n}</div>
        <div className="d">{d}</div>
      </div>
    ),
  },
  {
    key: 'journey',
    kind: 'WhatsApp · 1080 × 1350',
    title: 'Funeral journey card',
    body: 'Every stop in order with times, to share once the arrangements are final.',
    action: 'Download PNG',
    run: A.journeyCard,
    preview: (n) => (
      <div>
        <div className="k">Funeral journey</div>
        <div className="n">{n}</div>
        <div className="d">Stops · times · directions link</div>
      </div>
    ),
  },
  {
    key: 'qr',
    kind: 'Print · 4 × 5 in · 300 dpi',
    title: 'QR card',
    body: 'A framed QR code for the entrance, the guest book table or the back of the programme.',
    action: 'Download PNG',
    run: A.qrCard,
    preview: (_n, _d, url) => <QrImage url={url} label="Memorial QR" />,
  },
  {
    key: 'programme',
    kind: 'A4 PDF',
    title: 'Printable programme',
    body: 'A cover with their portrait, the order of service with start times, the journey and a closing page with a QR code. Ready to print.',
    action: 'Download PDF',
    run: A.programmePdf,
    preview: (n) => (
      <div>
        <div className="k">Order of service</div>
        <div className="n">{n}</div>
        <div className="d">Programme · journey · family message</div>
      </div>
    ),
  },
  {
    key: 'booklet',
    kind: 'A5 booklet · print at home',
    title: 'Programme booklet',
    body: 'The programme and their story as a folded A5 booklet. Print double-sided on A4, flip on the short edge, then fold in half.',
    action: 'Download PDF',
    run: A.programmeBooklet,
    preview: (n) => (
      <div>
        <div className="k">A5 booklet</div>
        <div className="n">{n}</div>
        <div className="d">Cover · story · programme · journey</div>
      </div>
    ),
  },
  {
    key: 'keepsake-card',
    kind: 'Print · 5 × 7 in · 300 dpi',
    title: 'Keepsake card',
    body: 'A small card with a line from their story, to print and hand to guests.',
    action: 'Download PNG',
    run: A.keepsakeCard,
    preview: (n, d) => (
      <div>
        <div className="k">In loving memory</div>
        <div className="n">{n}</div>
        <div className="d">{d}</div>
      </div>
    ),
  },
  {
    key: 'keepsake',
    kind: 'A4 PDF',
    title: 'Keepsake book',
    body: 'Everything, preserved and printable: their story, the programme, the journey and the family’s words.',
    action: 'Download PDF',
    run: A.keepsakePdf,
    dark: true,
    preview: (n) => (
      <div>
        <div className="k">Keepsake</div>
        <div className="n">{n}</div>
        <div className="d">Story · programme · journey</div>
      </div>
    ),
  },
];

export function ArtifactStudio({ draft, slug, caseId }: { draft: Draft; slug: string; caseId: string }) {
  const toast = useToast();
  const origin = useOrigin();
  const [busy, setBusy] = useState('');
  const url = `${origin}/m/${slug}`;
  const name = displayName(draft.person);
  const dates = lifeDates(draft.person);

  return (
    <main className="container">
      <div className="page-head">
        <div>
          <span className="eyebrow">Cards, programme & keepsake</span>
          <h1 className="h1" style={{ margin: '10px 0 10px' }}>
            Everything to share, from one memorial.
          </h1>
          <p className="lede">Each download is made fresh from the live memorial, so a changed time or corrected name is always current.</p>
        </div>
        <Link className="btn" href={`/memorials/${caseId}?step=publish`}>
          ← Back to memorial
        </Link>
      </div>
      <div className="artifact-grid">
        {ITEMS.map((item) => (
          <article className="artifact" key={item.key}>
            <div className={`preview ${item.dark ? 'dark' : ''}`}>{origin && item.preview(name, dates, url)}</div>
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
                    await item.run({ draft, url, slug });
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
