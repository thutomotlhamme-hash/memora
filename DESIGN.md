# Memora design notes

**Reference:** [Refero Styles](https://styles.refero.design/) → the *Anthropic* style: warm editorial minimalism.

It was chosen because a memorial has to feel calm, dignified and human (not "app-like") while funeral logistics still need to be precise and legible on a phone in bright sun. That style does both: an ivory paper ground, near-black ink, one warm clay accent, an editorial serif for moments of meaning and a quiet sans for everything functional.

Memora borrows the *aesthetic*, not the brand: no logos, and open-licence fonts.

## Tokens (`src/app/globals.css`)

| Token | Value | Use |
| --- | --- | --- |
| `--paper` | `#faf9f5` | page ground |
| `--paper-2` | `#f0eee6` | tinted sections, notes |
| `--night` | `#141413` | memorial hero, live panel, checkout |
| `--ink` / `--ink-2` / `--muted` | `#141413` / `#3d3d3a` / `#66655f` | text (muted is 5.5:1 on paper) |
| `--clay` | `#b5552f` | the single accent: live pill, progress, accent buttons (white text 4.9:1) |
| `--clay-ink` | `#9f4829` | eyebrows and labels on light grounds |
| `--sage` / `--rust` | | success / error, used sparingly |

- **Type:** Newsreader (optical-size variable) for display, names and the story; Inter for UI. Display sizes are tight (−0.02em) and balanced; body text is 16px/1.55; the life story is set in serif at 18–20px for reading.
- **Shape:** 8/12/18/24px radii, hairline `rgba(20,20,19,.1)` rules, almost no shadow except on the keepsake and the memorial portrait.
- **Rhythm:** a generous 1160px column, a 16–40px fluid gutter, and 64–112px section padding. On memorial pages the eyebrow label sits in a left rail with the content beside it.

## Principles

1. **One accent.** Clay marks what is live, what to do next, and progress. Nothing else competes.
2. **Serif for meaning, sans for logistics.** Names, story and headings are serif; times, addresses and buttons are sans.
3. **Night for the moment that matters.** The memorial hero and the Live panel invert to `--night`, so the funeral-day guide is unmistakable.
4. **Phone first.** No horizontal scroll at 390px (checked with Playwright screenshots), tap targets of 36–52px, sticky section nav on the memorial.
5. **Accessible by default.** AA contrast on every text token, visible focus rings, `prefers-reduced-motion` honoured, and a print stylesheet for the memorial.
