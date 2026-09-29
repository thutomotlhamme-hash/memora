import type { Draft } from '@/lib/memorial';

export const STEPS = [
  { id: 'person', label: 'Loved one' },
  { id: 'journey', label: 'Funeral journey' },
  { id: 'story', label: 'Story & programme' },
  { id: 'review', label: 'Review' },
  { id: 'publish', label: 'Publish & share' },
] as const;
export type StepId = (typeof STEPS)[number]['id'];

export type Nav = { back: (() => void) | null; next: (() => void) | null; nextLabel: string };
export type Update = (fn: (d: Draft) => Draft) => void;

export function PanelFoot({ nav, children }: { nav: Nav; children?: React.ReactNode }) {
  return (
    <div className="panel-foot">
      {nav.back ? (
        <button className="btn ghost" type="button" onClick={nav.back}>
          ← Back
        </button>
      ) : (
        <span />
      )}
      {children ??
        (nav.next && (
          <button className="btn primary" type="button" onClick={nav.next}>
            {nav.nextLabel}
          </button>
        ))}
    </div>
  );
}
