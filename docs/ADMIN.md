# Running Memora: admin handbook

## Who is an admin, and how we know

Admins are identified by a **confirmed email address**. Not a phone number, and not a link.

| Role | How they get it | What they can do |
| --- | --- | --- |
| **Owner** | Their email is in `MEMORA_ADMIN_EMAILS` in Netlify (comma-separated). Only changeable in Netlify, so nobody can lock the owner out from inside the app. | Everything, including adding and removing staff |
| **Staff** | An owner adds their email on **/admin → Team** | Everything except changing the team |

For access, the person must be **signed in** with that exact email **and have confirmed it** from their inbox. Every page load and every action checks this again, so removing someone takes effect immediately.

### Adding a staff member
1. Admin → Team → type their email → **Add**.
2. Press **Copy invite** and send it on WhatsApp. It tells them to sign up with that exact email and confirm it.
3. Once confirmed, an **Admin** link appears in their header.

Forwarding the invite doesn't help anyone else: the link is just the sign-up page. Access comes from the confirmed email, not the link.

## What admins see

- **Needs attention:**
  - funerals within 3 days that aren't published;
  - families who paid but haven't published;
  - payments or gifts stuck at Yoco;
  - gifts not started after a day.
- **Gifts:** every gift, soonest funeral first, with WhatsApp, Copy link, Mark contacted, Fix number, and Cancel & refund.
- **Memorials:** every memorial with the family's account email, funeral date and status, plus Take down and Restore.
- **Payments:** every order, with Check with Yoco and Mark refunded.
- **Team:** owners and staff.
- **Contact-form messages:** live in Netlify (the button at the top of Admin opens them).

Every admin action is recorded in `memora_activity_log` with who did it and why.

## When things go wrong

| Situation | What happened | What to do |
| --- | --- | --- |
| "I paid but it still says pay" | Yoco hasn't confirmed yet (slow webhook, or the family closed the page early) | Payments → **Check with Yoco**. It asks Yoco directly and unlocks publishing if paid. |
| Gift buyer says they paid, no link | Same, for a gift | Gifts or Needs attention → **Check with Yoco**, then **Copy link** and send it to the buyer or family. |
| Buyer lost the gift link | Closed the thank-you page | Gifts → **Copy link**, or **WhatsApp** the family directly. |
| Wrong WhatsApp number on a gift | Typo | Gifts → **Fix number**, then **WhatsApp**. |
| Gift link says "already used" | Someone else redeemed it, or the family made a second account | Check Memorials for the gift's memorial and its account email. If it was a mistake, help them sign in with the right account. |
| Buyer wants a refund for an unused gift | Changed their mind (within 30 days) | Refund in the **Yoco portal**, then Gifts → **Cancel & refund** (the link stops working). |
| Family wants a refund, not published | Within 7 days | Refund in the Yoco portal, then Payments → **Mark refunded**. |
| Harmful content, a privacy complaint, or a family asks to remove a memorial | | Memorials → **Take down** (give the reason). The public link shows "no longer public" and the family keeps their draft. **Restore** undoes it within the public year. |
| Family paid but hasn't published | Stuck or unsure | Needs attention lists them. WhatsApp them and offer to help. |
| Funeral in 3 days, memorial not ready | | Needs attention lists them first. Contact the family today. |
| Someone who should be an admin sees "This account isn't on the team" | Signed in with a different email | They must sign in with the email you added, or you add the email they're using. |
| "Confirm your email first" | They never clicked the confirmation email | They check spam, or sign up again to get a fresh email. |
| "Admin isn't set up yet" | `MEMORA_ADMIN_EMAILS` or `SUPABASE_SECRET_KEY` is missing in Netlify | Add both and redeploy. |
| A staff member leaves | | Team → **Remove**. Access stops immediately. |
| The owner leaves or changes email | | Change `MEMORA_ADMIN_EMAILS` in Netlify and redeploy. |

## The funeral-day coordinator (run-sheet)

The person running the programme on the day is **not** an admin and doesn't need an account. The family gets their link after publishing (Publish step → **Get the run-sheet link**) and sends it on WhatsApp. The link works until the family resets it or the memorial is taken down.

| Situation | What to do |
| --- | --- |
| The coordinator's link says "isn't working" | The family reset it, or it was copied incompletely. The family opens the editor → Publish → **Get the run-sheet link** and resends it. |
| The link was sent to the wrong person | The family presses **Reset link**. The old link stops working at once. |
| Two people are running it on two phones | That's fine. If both change something at the same moment, the second change is refused and that phone switches to the latest version with a message to redo it. |
| The coordinator has no signal | Changes stay on the phone ("No signal · will retry") and are sent when the connection returns. Keep the page open. |
| The family is editing while the coordinator runs the day | The family's editor refuses to overwrite the coordinator's changes and asks them to **Reload latest**. |
| Guests don't see a change | Their page updates about every 25 seconds while it's open on the funeral day. A refresh shows it immediately. |
| The whole programme was deleted by accident | That's not possible: the run-sheet always keeps at least one item. For bigger mistakes, the family fixes the programme in the editor. |

### Procession tracking

| Situation | What to do |
| --- | --- |
| "Location is blocked for this site" | On the coordinator's phone: browser settings → Site settings → Location → allow the Memora site, then tap the button again. |
| Guests see "Waiting for the next update" | The phone lost signal or its screen locked. Unlock it and keep the run-sheet open. Sharing continues by itself. |
| The wrong phone is sharing, or the coordinator changed cars | Tap **Continue from this phone** on the phone in the lead car. |
| Someone doesn't want their location shown | **Pause** hides it immediately. **End sharing** erases it. |
| Sharing was forgotten | It ends by itself on arrival or 6 hours after it started, and the position is erased. |

## Accounts: cellphone number and password

Families sign up with their **cellphone number and a password**. Nothing is ever sent to the phone, and there's no email to wait for. The number is how Memora recognises them on any device. Email sign-up is still there for people who prefer it; it sends a confirmation link.

Families don't have to sign up first. They build as a guest, and when they want to keep the memorial they tap **Save it**, type their number and password, and land back on the same step with everything moved into their account.

| Situation | What to do |
| --- | --- |
| "I forgot my password" | They tap **Forgot your password?** and enter their number, which brings them to you on WhatsApp or the contact form. **Check it's really them** (ask for the name on their memorial, or the funeral date). Then Admin → Team → **Help someone log in** → their number → **Set temporary password** → **Send on WhatsApp**. They change it under Account. |
| "It says my number already has an account" | They signed up before. They tap **I already have an account**. If they don't remember the password, use Help someone log in. |
| "Someone else registered my number" | Rare. Check who it is (look at the memorials on that account in Admin → Memorials), then help the real owner log in with a temporary password. |
| They typed the wrong number | They log in with the number they actually typed; it's their login. If they can't remember it, find their memorial in Admin → Memorials: the account's number shows next to it. |

### Adding a teammate (changed)
1. Admin → Team → **Copy sign-up message** and send it to them on WhatsApp. They create their own Memora account first (cellphone or email).
2. They send you the number or email they used. Add it under **Add someone**.

Only existing accounts can be added. Nobody can sign up with a teammate's details afterwards and inherit their access.
