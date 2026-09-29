# Memora design notes

**Reference:** a product-launch "white gallery" style (Refero Styles: the Apple product-page reference). The page is a quiet gallery: large product renders take the centre, compact near-black type carries each claim, and one precise blue is kept for actions only.

Memora borrows the *cadence and feel*, not the brand. There are no Apple logos, product names or imagery. Type uses SF Pro where the device already has it (Apple devices) and falls back to Inter everywhere else.

## Tokens (`src/app/globals.css`)

| Token | Value | Use |
| --- | --- | --- |
| `--paper` | `#ffffff` | Page canvas, hero and storytelling sections |
| `--paper-2` | `#f5f5f7` | Alternate full-width bands, app screens behind white panels, footer |
| `--ink` | `#1d1d1f` | Headlines and body |
| `--muted` / `--faint` | `#6e6e73` / `#86868b` | Secondary copy, the grey second line of a headline |
| `--clay` | `#0071e3` | Filled buttons, focus rings, progress, "now" markers |
| `--clay-ink` | `#0066cc` | Inline and "›" links |
| `--launch` | `#b64400` | Small kickers and "New" labels (plain text, never a pill) |
| `--night` | `#000000` | The one dark chapter per page, the live panel |
| `--r-lg` | `28px` | Cards and media frames; buttons are full pills |

Not tokenised on purpose:
- **No shadows on content.** Separation comes from white on `#f5f5f7` and hairlines. The only shadows are on floating popovers and the product renders.
- **No gradients** on surfaces.

## Type
- **Display:** 600 weight with tight tracking. The hero is 48–96px at −0.015em; chapter titles are 32–56px.
- **Body:** 17px/1.47 with slightly negative tracking. Links are blue with a "›" chevron.
- **Kickers:** 14–21px/600 in `--launch`, never uppercase.

## Motion
Everything uses Apple's long ease-out: `cubic-bezier(0.28, 0.11, 0.32, 1)`.
- **Scroll reveals:** any `.reveal` fades up 44px over 1.1s the first time it enters view (`RevealObserver`). `.from-left` and `.from-right` slide in sideways. Stagger siblings with `style={{ '--d': '0.08s' }}`.
- **Hero entrance:** copy rises in a stagger and the product scene settles in.
- **Scroll-linked zoom:** where supported, the hero scene recedes as you scroll past it and `.zoom-soft` visuals grow into place. There's no fallback because none is needed.
- **Highlights carousel:** scroll-snap cards that advance every 5.2s while in view, with a filling progress dot and a play/pause pill. It stops as soon as someone touches it.
- **Sticky bars:** frosted glass (`saturate(180%) blur(20px)`) on the header, the landing page's local nav once it sticks, and the memorial's section nav.
- **Reduced motion:** reveals become a plain fade; autoplay, pulses and zooms are off.

## Components
- **Buttons:** 980px pills. `.primary` is blue; the default is a hairline outline; `.ghost` is text only.
- **Panels and cards:** white, 28px radius, no border, on the `#f5f5f7` band.
- **Inputs:** 50px tall, 12px radius, blue focus ring.
- **Product renders** (`src/components/landing/Visuals.tsx`): the phone, programme sheet, QR card, map, live card, procession and run-sheet are drawn in HTML/SVG, so they're crisp at any size and need no photography.
