'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { KeepsakeThumb } from '@/components/KeepsakeThumb';
import type { Draft } from '@/lib/memorial';

/**
 * A past funeral's programme, as a small cover. Its content is only fetched
 * when the card scrolls into view, so a long list of past funerals stays quick.
 */
export function PastKeepsake({ caseId, name, when, privateNow }: { caseId: string; name: string; when: string; privateNow: boolean }) {
  const box = useRef<HTMLAnchorElement>(null);
  const [data, setData] = useState<{ draft: Draft; url: string } | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    let live = true;
    const load = () =>
      fetch(`/api/memorials/${caseId}/keepsake`, { cache: 'no-store' })
        .then((r) => (r.ok ? r.json() : null))
        .then((b) => {
          if (!live) return;
          if (b?.draft) setData({ draft: b.draft as Draft, url: `${window.location.origin}/m/${b.slug}` });
          else setFailed(true);
        })
        .catch(() => live && setFailed(true));
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          io.disconnect();
          void load();
        }
      },
      { rootMargin: '300px' },
    );
    io.observe(el);
    return () => {
      live = false;
      io.disconnect();
    };
  }, [caseId]);
  return (
    <Link ref={box} href={`/memorials/${caseId}/artifacts`} className="past-ks">
      <span className="past-ks-frame">
        {data ? (
          <KeepsakeThumb kind="programme" draft={data.draft} url={data.url} width={360} alt={`Programme for ${name}`} />
        ) : failed ? (
          <span className="ks-thumb ready past-ks-plain" aria-hidden="true">
            <small>Order of service</small>
            <b>{name}</b>
          </span>
        ) : (
          <span className="ks-thumb" aria-hidden="true" />
        )}
      </span>
      <span className="past-ks-text">
        <strong>{name}</strong>
        <small>
          {when}
          {privateNow ? ' · private now' : ''}
        </small>
      </span>
    </Link>
  );
}
