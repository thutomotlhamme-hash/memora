import { StatusScreen } from '@/components/MemorialView';

export default function NotFound() {
  return <StatusScreen eyebrow="Not found" title="We couldn’t find that page." body="It may have moved, or the link may be incomplete." />;
}
