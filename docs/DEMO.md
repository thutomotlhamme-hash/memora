# Demo data

`supabase/demo/seed_demo.sql` fills Memora with a complete, realistic picture so
everyone can see every step in the command centre and on the funeral-home
dashboards. Dates are relative to the day it runs, so it always looks current.
Run it again to refresh it; `supabase/demo/remove_demo.sql` removes all of it
and touches nothing real.

Replace `__DEMO_PASSWORD__` before running. Every demo person logs in at
`/account/login` with their cellphone number and that password.

## Letsatsi Funeral Services (Pro Plus, active)

| Person | Number | Role | Sees |
|---|---|---|---|
| Lerato Mokoena | 062 568 3101 | Owner | Every branch, people, branding, billing |
| Sipho Dlamini | 062 568 3102 | Branch manager, Soweto | Soweto's funerals; appoints Soweto arrangers |
| Nomsa Khumalo | 062 568 3103 | Arranger, Soweto | Soweto's funerals: prepare, publish, run the day |
| Themba Nkosi | 062 568 3104 | Arranger, Soweto | As above |
| Ayanda Zulu | 062 568 3105 | Branch manager, Pimville | Pimville only |
| Kagiso Molefe | 062 568 3106 | Arranger, Pimville | Pimville only |

Tembisa branch has no staff yet (the owner runs it).

Funerals: Mpho Maluleke (Tembisa, **today**), Thabo Radebe (Soweto, in 2 days,
live), Nomvula Khumalo (Soweto, **started by the family from a family link**,
draft, in 9 days), Petrus Mahlangu (Soweto, in 12 days, live), Dikeledi Sebola
(Pimville, draft, no date yet), Jabulani Ndlovu (Pimville, done).

Family links: Khumalo (used), Zwane (waiting), Mabena (expired), Shabalala
(switched off). Invoices: last month paid (with onboarding), this month draft.

## Umoya Funerals (Pro, trial)

Set itself up from an onboarding link. Zanele Mthembu (062 568 3107) owns it;
Priya Naidoo (062 568 3108) is an arranger at the Umlazi branch. One draft:
Sibusiso Cele.

## Everyone else

- Families on their own: Johan van Wyk (062 568 3110, Hendrik van Wyk, live,
  cremation) and Aisha Patel (062 568 3111, Yusuf Patel, draft).
- The family from the link: Buhle Khumalo (062 568 3109) sees only her
  mother's memorial and can't publish or pay; Letsatsi publishes.
- Our own team: a draft for Samuel Sithole in the owner's account.
- Onboarding links: Umoya (used), Kopano Funerals (waiting), Hope Funeral
  Parlour (expired).

## Things to try

1. As the owner (3101): *Branches & people* → add a branch, appoint a
   manager, remove a branch (its memorials move), move a memorial between
   branches.
2. As Sipho (3102): appoint an arranger in Soweto. There's no option to
   appoint a manager, and Pimville isn't shown.
3. As Nomsa (3103): open Nomvula Khumalo's draft (the family's), publish it,
   get the run-sheet for Thabo Radebe.
4. As Buhle (3109): open the memorial; step 5 says Letsatsi publishes it.
5. As yourself: Command centre → Memorials (grouped by home, our team, and
   families), Funeral homes (onboarding links), Access (by branch), Billing,
   Audit log.

## Motheo Funeral Group (Enterprise, active)

A group with two regions, three homes and five branches. You (062 568 3235) are one of its
group administrators, so **Group** shows in your header and `/pro/group` opens it.

| Person | Number | Role | Sees |
|---|---|---|---|
| Thandi Motheo | 062 568 3120 | Group administrator | The whole group, its configuration, every home |
| Lerato Dube | 062 568 3121 | Regional manager, Gauteng | Pretoria Central, Centurion, Soweto only |
| Karabo Sithebe | 062 568 3122 | Finance | Contract, usage, invoices; no memorials |
| Palesa Nthite | 062 568 3123 | Brand and marketing | Master brand and templates |
| Neo Mabuza | 062 568 3124 | Reporting and audit | Read-only reports and audit log |
| Tshepo Maseko | 062 568 3125 | Branch manager, Pretoria Central | That branch |
| Dineo Phiri | 062 568 3126 | Arranger, Pretoria Central | That branch; sees head office's templates |
| Boitumelo Kgosi | 062 568 3127 | Arranger, Mahikeng | That branch; sees only the all-branch template |
| Refilwe Molapo | 062 568 3128 | A family (Motsamai) | Their memorial, started from a family link |

What's in it:
- **Structure:**
  - Gauteng: Motheo Pretoria (Pretoria Central, Centurion) and Motheo Soweto (Soweto).
  - North West: Motheo North West (Mahikeng, and Rustenburg, which is switched off).
- **Funerals:**
  - one today;
  - two this week;
  - a Mahikeng memorial **not yet published with the funeral in two days** (it shows under
    Needs attention);
  - one done;
  - one whose **first year is ending**, where the family asked about the unveiling.
- **Brand and templates:** the brand locks the colour and footer. Templates:
  - "Funeral service" for every branch;
  - "Zion Christian Church service" for Gauteng only;
  - an obituary opening.
- **Billing and the rest:**
  - last month's invoice is paid, with onboarding;
  - an invite is waiting for a new finance clerk;
  - there's an audit trail with before and after.

## First years ending

Agnes Mofokeng (Letsatsi, Soweto) and Ditiro Seleke (Motheo, Mahikeng) were published about
ten months ago. Their homes see them under **First years ending**, and both families have
asked about the unveiling (command centre → Needs attention).
