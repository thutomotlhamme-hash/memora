import 'server-only';

import { revalidatePath } from 'next/cache';

/**
 * Public memorial pages are cached for a minute at the edge. After any change a
 * guest could see (edits, publishing, the run-sheet, take-downs) we drop the
 * cache so the next visit renders fresh.
 */
export function refreshPublicPages() {
  try {
    revalidatePath('/m/[slug]', 'page');
  } catch {
    /* outside a request (tests): nothing cached to drop */
  }
}
