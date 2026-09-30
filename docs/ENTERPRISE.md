# Memora Pro and Enterprise: how it works

Memora has two commercial worlds.

- **Memora Complete**: a family buys one memorial for **R899** once-off. Unchanged.
- **Memora Pro**: funeral homes run funerals through Memora.
  PAYG → Pro → Pro Plus → Enterprise.

## Pro plans (src/lib/plans.ts)

| Plan | Monthly | Included / month | Each extra | Branches | Onboarding |
| --- | --- | --- | --- | --- | --- |
| Pro Pay-as-you-go | R0 | 0 | R1,490 | 1 | none |
| Pro | R6,500 | 5 | R899 | 1 | R3,500 |
| Pro Plus | R14,500 | 15 | R699 | 3 | R6,500 |
| Enterprise | from R35,000 | 50 (contract) | from R499 (contract) | contract | from R9,500 (contract) |

All prices exclude VAT (15% is added on invoices). Every plan is the same shape: base fee,
monthly allowance, price per extra memorial, and once-off onboarding. One function,
`proInvoice`, works out every invoice.

### What counts

- A memorial counts **once**, in the month it is **first published** under a funeral home.
  Drafts, previews, family links that are never finished, and failed payments never count.
  Editing, re-publishing, taking down and restoring never count again.
- The ledger is `memora_org_usage`, keyed by the memorial's id and written at publish time.
- Allowances reset each calendar month (South African time).
- Credits and extra charges go in `memora_billing_adjustments`, each with a reason.

## Enterprise: the group operating layer

Enterprise is configuration, not custom code:
- **Account** (`memora_accounts`): the contract, status, modules, master brand and blueprint.
- **Regions** (`memora_regions`, optional): provinces, regions, districts, brands or divisions.
- **Funeral homes**: business units (`memora_orgs.account_id`).
- **Branches** (`memora_branches.region_id`, `active`).
- **Teams** (`memora_groups` with `account_id`, and `region_id` for regional managers).

Existing Pro homes have no account and behave exactly as before.

### Roles (src/lib/rbac.ts)

Access is permission-based. Group roles reach into the group's homes through `orgGrants`.

| Role | Sees | Can |
| --- | --- | --- |
| Group administrator | whole group | everything in the group; owner-level in every home |
| Regional manager | their region | run their region's branches, appoint branch managers and arrangers, reports |
| Finance | whole group | contract, usage, invoices; no memorial editing |
| Brand and marketing | whole group | master brand, locks, central templates |
| Reporting and audit | whole group | read-only reports and audit log |
| Integrations | whole group | create and revoke integration keys |
| Owner / Branch manager / Arranger | their home or branch | as in Pro |

Memora's own team open any group as a clearly marked **Memora Support View**. Everything
they change goes into the group's audit log.

### Suspension

If a group is **suspended** or **closed**, its staff lose access at once. The database edit
check (`memora_org_edits`) enforces this too. Published memorials stay up for families;
nothing is deleted.

### Modules (feature flags)

`regions`, `advanced_reporting` (arranger breakdown and CSV), `audit_log`,
`central_templates`, `brand_governance`, `api_access`, `bulk_import`, `advanced_finance`,
`sla_controls`. `custom_domain`, `webhooks` and `sso` are recorded but not built yet.

## Creating an Enterprise account (about 5 minutes)

Go to **Command centre → Enterprise → Create Enterprise account**. You need both
Operations and Finance rights (an administrator has both).

1. Pick a blueprint (Standard group, Franchise, Insurer, Funeral network). It pre-fills
   modules, brand locks and terms.
2. Fill in contacts, contract terms and dates, SLA and support.
3. Paste the structure, one branch per line:
   `Gauteng > Motheo Pretoria > Pretoria Central | Arcadia`
4. Add the brand colour, footer and (optionally) a logo link.
5. Add head office's administrators by cellphone number or email. People with an
   account are added now; others get a one-time link (on the group's People page).
6. Press **Create Enterprise**.

In one step Memora then creates:
- the account;
- its regions, homes and branches;
- the teams (Group administrators, Finance, Brand and marketing, Reporting and audit,
  Integrations if API access is on, and a Regional managers team per region);
- the owners, managers and arrangers teams in each home;
- starter templates;
- invite links;
- the audit entry.

If anything fails, nothing is kept.

## Group control centre (/pro/group)

**Overview**:
- funerals today, this week and this month;
- drafts;
- the allowance used;
- what needs attention: unpublished memorials with a funeral within two days,
  switched-off branches that still have funerals, overage, and quiet branches;
- branches by region.

**Regions & branches**: add, rename or remove regions (removing one needs its name typed);
move branches between regions; switch branches on or off; add homes and branches;
bulk import.

**People**: head-office and regional teams; each home's teams; bulk invite from pasted
spreadsheet rows (`number, role, place`); invite links.

**Reports**: filter by date, region, home, branch and status. See by region, by branch and
by arranger. CSV export with formula-injection protection.

**Contract & usage**, **Brand** (master brand, what homes may not change, and a preview of
every home), **Templates** (published to all, some regions or some branches),
**Audit log** (with before and after), **Integrations** (keys shown once and stored as a
SHA-256 hash), and **Roles**.

## The first year and the unveiling

Memorials stay public for 365 days. Families see a first-year timer. In the last 90 days
they get a card to say they're planning the unveiling; that registers interest in
`memora_event_interest`. Funeral homes see **First years ending** on their Today screen.
The command centre overview lists interested families: the first customers for the
events product.

## Migrations

- `0017_memora_pro_billing.sql`: allowance, usage ledger (backfilled), adjustments and
  invoice lines. Homes on the old list prices moved to the new terms, which never cost
  more; custom prices were kept.
- `0018_memora_enterprise.sql`: accounts, regions, account invoices, templates, API keys,
  audit scoping, account invites, and the updated `memora_org_edits`.
- `0019_memora_unveiling_interest.sql`: unveiling interest.

All three are applied to the live project. No manual action is needed.
