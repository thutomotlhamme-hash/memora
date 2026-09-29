import { ImageResponse } from 'next/og';
import { OgCard } from '@/components/OgCard';
import { PRICE_LABEL } from '@/lib/plans';

export const alt = 'Give a memorial with Memora';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function Image() {
  return new ImageResponse(
    <OgCard
      kicker="Give a memorial"
      title="One less thing for the family to carry."
      subtitle={`Pay ${PRICE_LABEL} and send a grieving family a private link to create their memorial, already paid for.`}
    />,
    size,
  );
}
