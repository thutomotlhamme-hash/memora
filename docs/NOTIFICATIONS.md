# Notifications

In-app only, for now: a bell with an unread count on every signed-in page, in
the funeral-home Studio and in the group control centre. Accounts are cellphone
logins with no SMS or email, so nothing is sent outside Memora. Browser push or
WhatsApp can be added later on top of the same table (`memora_notifications`).

Recipients come from the role definitions in `src/lib/rbac.ts`
(`src/lib/notifications.ts`), so nobody hears about something their role
doesn't cover. Nobody is notified about their own action, and each
notification reaches a person only once.

## When something happens

| Event | Who hears |
|---|---|
| A family starts a memorial from a family link | That branch's arrangers and manager, the home's owners, and the group admins and region's regional managers (Enterprise) |
| The family taps "Let the home know it's ready" | Whoever can publish in that branch (as above) |
| A funeral home publishes a memorial | The family |
| A home reaches 80% / 100% of its monthly allowance | The home's owners. In a group: group admins and finance |
| A family asks about the unveiling | That branch's staff (as above) |
| Someone is added to, or removed from, a team | That person |
| Someone accepts a group invite | The group's administrators |
| A funeral home sets itself up from an onboarding link | Memora's operations team and administrators |
| A funeral home is made active or switched off | Its owners |
| An invoice is marked sent | The home's owners. In a group: group admins and finance |
| A group's status changes (active, suspended…) | Everyone in the group's head-office teams |

## Situations (checked when someone opens their notifications)

| Situation | Who hears |
|---|---|
| A memorial isn't published and the funeral is within 2 days | The family, and the staff who look after that branch |
| A funeral is today | The family, and the branch's staff (with a link to the run-sheet) |
| A memorial's first year has 90 days or fewer left | The family |
