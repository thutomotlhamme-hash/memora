# Memora: 90-day launch plan

**Goal for day 90:** 60 published memorials and 15 gifts (about R67 000 revenue), with at least 1 in 3 new memorials coming from someone who saw a shared Memora memorial or QR code.

**Budget:** R0 for the first 30 days (your network and partners), then up to R3 000 a month on ads once you know which message works.

## How Memora grows

Every published memorial is shared with 100–500 people on WhatsApp, and its QR code is printed in the programme. Those guests will organise a funeral one day, or know someone who is. So the job is:

1. **Get the first memorials made** (your network, churches, printers).
2. **Make every memorial a quiet advert:** the link preview, the "Made with Memora" footer, and the QR code on printed programmes.
3. **Turn guests into gifters and future organisers:** the "Give a memorial" page and gentle calls to action on each memorial.

## Phase 1: Friends & first 10 (days 1–30)

| Week | Do | Done when |
| --- | --- | --- |
| 1 | Link Netlify to GitHub and deploy. Add the Supabase secret key and Yoco key. Pay for one test memorial and one test gift end to end. Set up Netlify form notifications. | A real R899 payment has gone through and been refunded |
| 1 | Make **3 example memorials** with permission (a grandparent, a family friend, a public figure's tribute). Screenshots of these feed all marketing. | 3 memorials with real photos you're allowed to use |
| 2 | Post the launch on your own WhatsApp Status, Facebook and LinkedIn (see the copy bank). Ask 20 people personally to share it. | 20 people shared it |
| 2 | Visit or message **10 churches** near you. Offer to build their next funeral programme free, as a demo (see the church pitch in the copy bank). | 3 churches say yes |
| 3 | Visit **5 printers and copy shops** that print funeral programmes. Offer them the partner deal (see [05-partners.md](05-partners.md)). | 2 printers put up a poster or flyer |
| 3–4 | Do every early memorial **with** the family (call or WhatsApp). Note every question they ask; fix the confusing parts. | 10 published memorials |
| 4 | Ask each family: *"Can we use your memorial (with your permission) as an example?"* and *"Who else could this help?"* | 3 written testimonials |

## Phase 2: Partners & content (days 31–60)

- **Churches:** give each partner church a laminated QR poster for the office and a short line for the notice board or bulletin: *"Planning a funeral? The church office can help you make the programme and directions on Memora."*
- **Burial societies and stokvels:** ask to speak for 5 minutes at a monthly meeting. Offer members a partner code (see partners).
- **Content, 3 times a week:** TikTok, Instagram Reels and Facebook (see the content calendar). Topics: "How to make a funeral programme on your phone", "What to include in an obituary", a before/after of messy WhatsApp directions versus one Memora link.
- **Google Business Profile:** create one (free), add photos, and ask each family for a review.
- **Start small ads (R1 500/month):** Facebook and Instagram, "Give a memorial" angle only, targeting South Africa plus South Africans abroad (UK, Australia, UAE). Never target by bereavement.

## Phase 3: Scale what works (days 61–90)

- Put 80% of the ad budget on the best-performing ad (cost per gift/memorial below R250 is good).
- **Google Search ads** (R1 500/month) on high-intent searches: *funeral programme template*, *funeral programme South Africa*, *obituary template*, *funeral programme printing* (see the keyword list in the copy bank).
- **Diaspora push:** messages and ads for South Africans abroad: *"Can't be home for the funeral? Give the family a memorial, and follow the day live."*
- **Monthly partner payout and thank-you:** pay commissions on the 1st, and send each partner a thank-you with their numbers.
- **Decide what to build next** from what families asked for (e.g. a guest book, a video tribute, printing through partners).

## Weekly rhythm (30 minutes, every Monday)

1. Check `/admin`: any gift with a funeral in the next 3 days that isn't published gets a WhatsApp today.
2. Check Netlify form messages and reply to every one within 24 hours.
3. Update the scoreboard below.
4. Post 3 pieces of content and message 5 new potential partners.

## Scoreboard

| Metric | How to count | Day 30 | Day 60 | Day 90 |
| --- | --- | --- | --- | --- |
| Memorials published | Supabase: `memora_cases` where status = PUBLISHED | 10 | 30 | 60 |
| Gifts paid | `/admin` board | 2 | 7 | 15 |
| Gift → published | Published ÷ paid gifts | 70% | 75% | 80% |
| Share-sourced memorials | Ask "How did you hear about us?" at signup (next build) | — | 25% | 33% |
| Partner referrals | Partner code use | 0 | 5 | 15 |
| Cost per paying customer (ads) | Ad spend ÷ paid memorials and gifts from ads | — | < R300 | < R250 |

## Money

- **Price:** R899 once-off per memorial.
- **Costs per sale:** Yoco's card fee (check the percentage in your Yoco account), plus a partner commission (R100) when a partner referred them. Hosting (Supabase, Netlify) is free at this scale.
- **Roughly R750+ per sale stays with you**, so 20 sales a month is about R15 000 a month, and 60 is about R45 000.

## Build next (in this order)

1. **"How did you hear about us?"** at signup, to measure what works.
2. **Partner codes:** a code on the gift and publish pages, tracked on `/admin`, for paying commission.
3. **A "Give a memorial" line** at the end of each memorial. ("Made with Memora · Create a memorial" is already in the footer.)
4. **A guest book** (moderated tributes) on the memorial. It brings guests back and is a reason to share again.
5. **Automatic WhatsApp** (Meta Cloud API) when volume makes manual follow-up heavy (about 30+ gifts a month).
