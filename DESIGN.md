# Memora design notes: Jacaranda

**Idea:** the colour of Pretoria in spring, and the church's colour for mourning and hope. Calm enough for grief, alive enough to celebrate a life. The approved direction board is the reference for colour, type and signatures.

## Palette (`src/app/globals.css`)

| Name | Hex | Token | Use |
| --- | --- | --- | --- |
| Petal | `#FBFAF8` | `--paper` | Page canvas |
| Mist | `#F2EEF7` | `--paper-2` | Bands, app screens behind white panels |
| Bloom | `#C9B8E8` | `--bloom` | Highlights, arch ring, the journey line ahead, links on dark |
| Jacaranda | `#5B3E8C` | `--clay` | Buttons, kickers, the journey line walked, focus |
| Deep bloom | `#3F2A66` | `--clay-ink` | Links, hover |
| Plum ink | `#1E1A24` | `--ink` | Text |
| Dusk | `#6B6475` | `--muted` | Secondary text |
| Vigil | `#15121C` | `--night` | Funeral-day screens and the dark chapter |
| Candle | `#E8A94A` | `--candle` | "Live" and "now", **on dark only** (plus the logo's end pin) |

## Type
- **Fraunces** (serif, soft) is for names, headlines and big moments. Weight is around 400. The accent word is in italic Jacaranda: "Remember *beautifully.*"
- **Instrument Sans** is for everything you read and tap, with neutral tracking.

## Signatures
- **The arch.** Every portrait sits in a church-window arch (`--arch`) with a Bloom ring: the memorial hero, editor, review, keepsakes and the landing page.
- **The journey line.** The logo's M is one path between two pins (jacaranda start, candle end). The same line runs through the memorial's funeral journey (stops hang off one thread), under the landing hero (it draws itself) and in the procession visuals.
- **Light, not shadow.** Soft bloom glows behind portraits, and a flickering candle glow on the funeral-day screens.

## Motion
The base curve is `cubic-bezier(0.28, 0.11, 0.32, 1)`; `--spring` is for small nudges.

**Kept from the previous build:**
- scroll reveals (`.reveal`, with `--d` for stagger);
- the staggered hero entrance;
- scroll-linked zoom;
- the highlights carousel with its play/pause pill;
- frosted sticky bars.

**Added:**
- headlines rise out of a soft blur;
- chapter titles de-blur as they reveal;
- the portrait arch unveils from the ground up;
- the journey line draws itself (hero SVG, and the memorial's thread stop by stop);
- the candle glow breathes on the day screens and the bloom breathes behind the hero;
- a pulsing candle dot on "New";
- springy button lift and arrow nudge;
- cross-page view transitions that carry the portrait between screens.

Reduced motion turns all of these into plain fades or nothing.
