import type { MetadataRoute } from 'next';
import { siteUrl } from '@/lib/config';

export default function sitemap(): MetadataRoute.Sitemap {
  const base = siteUrl();
  return [
    { url: `${base}/`, changeFrequency: 'weekly', priority: 1 },
    { url: `${base}/gift`, changeFrequency: 'monthly', priority: 0.8 },
    { url: `${base}/m/preview`, changeFrequency: 'monthly', priority: 0.6 },
    { url: `${base}/create`, changeFrequency: 'monthly', priority: 0.6 },
    { url: `${base}/privacy`, changeFrequency: 'yearly', priority: 0.2 },
    { url: `${base}/terms`, changeFrequency: 'yearly', priority: 0.2 },
  ];
}
