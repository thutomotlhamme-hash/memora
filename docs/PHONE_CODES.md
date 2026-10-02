# Confirming cellphone numbers

Everyone who logs in with a cellphone number confirms it once, with a 6-number
code, before they can publish a memorial: families and funeral-home staff alike.
The same codes let people reset a forgotten password on their own.

Nothing changes until a way to send codes is set up. While neither provider
below is configured, nobody is asked to confirm, and password help stays with a
person on WhatsApp, as before.

## How it works

- **WhatsApp first** (Meta's WhatsApp Cloud API, the cheapest way to reach a South
  African phone), **SMS as the backup** (BulkSMS) for people without WhatsApp or data.
- Codes expire after 10 minutes, allow 5 tries and work once. Only a hash is stored
  (`memora_phone_codes`, server-only).
- At most one code a minute, 5 an hour and 10 a day per number, plus a per-connection
  brake. This caps both abuse and cost.
- "Forgot password" answers the same whether or not a number has an account, so it
  can't be used to find out who uses Memora.
- Confirmation is stored in the account's `app_metadata` (`phone_confirmed_at`,
  `phone_confirmed_how`), which only the server can change.
- **Where people meet it:** a reminder on *My memorials* and in the Studio; the
  *Account* page; and a pop-up if they press Publish before confirming (publishing
  then carries on by itself).
- **Command centre → People:** shows *Number confirmed* or *not confirmed*. For someone a
  code can't reach, staff can **Mark number as confirmed** after checking with
  them on that number. The reason is required and kept in the audit log.
- People who log in with an email are never asked.

## Cost (approximate, October 2026)

| Way | Per code |
|---|---|
| WhatsApp (Meta, authentication message, South Africa) | about US$0.008 (≈ R0.15) |
| SMS (BulkSMS, South Africa) | about R0.25–R0.35 |

The SMS is plain text under 160 characters, so each code is billed as one SMS.

## Setting up WhatsApp (Meta Cloud API)

1. In [Meta Business Suite](https://business.facebook.com), verify the business.
2. At [developers.facebook.com](https://developers.facebook.com), create an app of
   type **Business** and add **WhatsApp**.
3. Add a phone number for Memora. It must not already be used on the WhatsApp app.
4. In **WhatsApp Manager → Message templates**, create a template:
   - **Category:** Authentication
   - **Name:** `memora_code`
   - **Language:** English
   - **Button:** *Copy code*

   Wait for it to be approved, usually within minutes.
5. Create a **System user** (Business settings → Users → System users). Give it the app
   and the WhatsApp account, then generate a **permanent token** with
   `whatsapp_business_messaging`.
6. In Netlify → Site configuration → Environment variables, add:
   - `WHATSAPP_TOKEN`: the permanent token
   - `WHATSAPP_PHONE_NUMBER_ID`: from WhatsApp → API Setup (the *Phone number ID*, not the number)
   - Optional: `WHATSAPP_CODE_TEMPLATE` (if not `memora_code`) and `WHATSAPP_CODE_LANGUAGE` (if not `en`)
7. Add a payment method in Meta, then redeploy.

## Setting up SMS (BulkSMS, optional backup)

1. Create an account at [bulksms.com](https://www.bulksms.com) and buy credits.
2. Go to **Settings → Developer Settings → API Tokens** and create a token.
3. In Netlify, add `BULKSMS_TOKEN_ID` and `BULKSMS_TOKEN_SECRET`, then redeploy.

Never paste these keys in chat or commit them. The command centre's setup list
shows whether each one is set.

## Turning it on safely

Once a provider is set, people who haven't confirmed are asked to confirm before
they publish. Their existing memorials stay up, and drafting is never blocked.
Test with your own number first: go to **Account → Confirm my number**.
