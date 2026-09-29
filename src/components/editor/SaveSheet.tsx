'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { QuickAccount } from '@/components/QuickAccount';
import { useToast } from '@/components/Toast';
import { moveGuestDraftIntoAccount } from '@/lib/memorials-client';

/**
 * Save a guest memorial without leaving it: number and password, and you're
 * back on the same step with the draft (photo included) in your account.
 */
export function SaveInline({ step, cta = 'Save and continue' }: { step: string; cta?: string }) {
  const router = useRouter();
  const toast = useToast();
  const [emailSent, setEmailSent] = useState('');

  if (emailSent) {
    return (
      <div className="note ok" role="status">
        <span>
          <strong>Check {emailSent}.</strong> Tap the link we sent, then log in here. Your draft stays safe on this device until then.
        </span>
      </div>
    );
  }
  return (
    <>
      <QuickAccount
        cta={cta}
        onSignedIn={async () => {
          try {
            const dest = await moveGuestDraftIntoAccount(step);
            toast('Saved. Your memorial is now in your account.');
            router.push(dest ?? '/memorials');
            router.refresh();
          } catch {
            toast('You’re logged in, but the draft didn’t move. Open My memorials to try again; it’s still on this device.', 'error');
            router.push('/memorials');
          }
        }}
        onNeedsEmailConfirm={setEmailSent}
      />
      <p className="consent">
        By saving you confirm you’re 18 or older and agree to the <Link href="/terms">terms</Link> and <Link href="/privacy">privacy policy</Link>.
      </p>
    </>
  );
}

export function SaveSheet({ step, onClose }: { step: string; onClose: () => void }) {
  const card = useRef<HTMLDivElement>(null);
  useEffect(() => {
    card.current?.querySelector<HTMLInputElement>('input')?.focus();
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', esc);
    return () => document.removeEventListener('keydown', esc);
  }, [onClose]);
  return (
    <div className="sheet-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="sheet" role="dialog" aria-modal="true" aria-labelledby="save-sheet-title" ref={card}>
        <button type="button" className="sheet-close" aria-label="Close" onClick={onClose}>
          ×
        </button>
        <span className="eyebrow">Keep it safe</span>
        <h2 className="h1" id="save-sheet-title" style={{ fontSize: 'clamp(28px, 4vw, 36px)', margin: '8px 0 6px' }}>
          Save your memorial.
        </h2>
        <p className="muted" style={{ margin: '0 0 8px' }}>
          Your cellphone number and a password. You’ll come straight back here, with everything you’ve done so far.
        </p>
        <SaveInline step={step} />
      </div>
    </div>
  );
}
