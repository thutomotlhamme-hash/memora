import type { MetadataRoute } from 'next';
import { paymentsOn, siteUrl } from '@/lib/config';

export default function sitemap(): MetadataRoute.Sitemap {
  const base = siteUrl();
  return [
    { url: `${base}/`, changeFrequency: 'weekly', priority: 1 },
    ...(paymentsOn ? [{ url: `${base}/gift`, changeFrequency: 'monthly' as const, priority: 0.8 }] : []),
    { url: `${base}/m/preview`, changeFrequency: 'monthly', priority: 0.6 },
    { url: `${base}/create`, changeFrequency: 'monthly', priority: 0.6 },
    { url: `${base}/contact`, changeFrequency: 'yearly', priority: 0.3 },
    { url: `${base}/privacy`, changeFrequency: 'yearly', priority: 0.2 },
    { url: `${base}/terms`, changeFrequency: 'yearly', priority: 0.2 },
  ];
}
