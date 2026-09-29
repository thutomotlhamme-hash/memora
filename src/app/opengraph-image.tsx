import { ImageResponse } from 'next/og';
import { OgCard } from '@/components/OgCard';

export const alt = 'Memora: remember beautifully';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function Image() {
  return new ImageResponse(
    <OgCard
      kicker="Memorial · Funeral journey · Keepsake"
      title="Remember beautifully."
      subtitle="Their story, every funeral stop with directions, the programme and one QR code for everyone."
    />,
    size,
  );
}
