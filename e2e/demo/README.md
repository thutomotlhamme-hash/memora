# Watchable demo

Opens a real browser on the live site and uses Memora the way families do:
twelve families from across South Africa (isiZulu, isiXhosa, Sesotho,
Setswana, Tshivenda, Xitsonga, Sepedi, Afrikaans, Cape Malay, Hindu, Cape
Coloured and English), covering burial, cremation, memorial only, private
burial later and "something else"; night vigils (short and whole-night);
prayer weeks; programmes with graveside parts; publishing; the guest view;
the A5 booklet; and one funeral held today, run live from the run-sheet while
the memorial updates beside it. A second file shows the failure cases.

```
npx playwright install chromium          # once
MEMORA_DEMO_PHONE=0721234567 npm run demo
```

- `MEMORA_DEMO_PHONE`: your number. Each family signs up with it and the last
  three digits replaced at random, so every run creates new accounts. No SMS or
  email is sent. Note these numbers may belong to real people; delete the demo
  accounts afterwards (Admin → Help log in / Team, or in Supabase Auth).
- `MEMORA_DEMO_SLOWMO=600` to slow it down further; `MEMORA_DEMO_URL` to point
  at another site (for example a local `next start`).
- Run one family: `npm run demo -- -g "Gqabaza"`.

Everything created is listed in `e2e/demo/output/created.jsonl` (family, phone,
memorial link). Videos of each run and the downloaded booklets are in
`e2e/demo/output/`. This is real data on the live site: archive or delete it
from Admin when you're done.
