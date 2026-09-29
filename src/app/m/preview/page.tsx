import { Suspense } from 'react';
import { GuestPreview } from '@/components/GuestPreview';

export const metadata = { title: 'Example memorial', robots: { index: false } };

export default function PreviewPage() {
  return (
    <Suspense>
      <GuestPreview />
    </Suspense>
  );
}
