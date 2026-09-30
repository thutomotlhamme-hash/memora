import { can, orgsOf } from '@/lib/rbac';
import { getAccess } from '@/lib/server/access';
import { json } from '@/lib/server/http';

/** For the header: may this person open the command centre, or a funeral home's dashboard? */
export async function GET() {
  const access = await getAccess();
  const p = access?.principal ?? null;
  return json({ signedIn: Boolean(access), team: can(p, 'ops.view'), pro: orgsOf(p).length > 0 || Boolean(p?.anyOrg.has('org.view')) });
}
