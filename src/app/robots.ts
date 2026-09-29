import type { MetadataRoute } from 'next';
import { siteUrl } from '@/lib/config';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: '*', allow: ['/', '/gift', '/m/preview', '/privacy', '/terms', '/contact'], disallow: ['/api/', '/memorials', '/admin', '/account', '/gift/r/', '/gift/thanks/', '/m/', '/run/'] }],
    sitemap: `${siteUrl()}/sitemap.xml`,
  };
}
