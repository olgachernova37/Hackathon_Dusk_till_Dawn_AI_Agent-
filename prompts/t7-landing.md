Rebuild the landing page of **Human-Gated AI Copilot** (this repo) as a single-viewport, video-backed hero. Recreate the visual system below exactly; the content, routing and architecture are adapted to this project.

## 0. Before writing code

This is Next.js 16.3 with breaking changes. Read these first and follow them over your training data:
- `node_modules/next/dist/docs/01-app/01-getting-started/05-server-and-client-components.md`
- `node_modules/next/dist/docs/01-app/01-getting-started/11-css.md`
- `node_modules/next/dist/docs/01-app/01-getting-started/13-fonts.md`
- `node_modules/next/dist/docs/01-app/02-guides/internationalization.md`

Also read `src/app/[lang]/page.tsx` (current landing), `src/app/[lang]/layout.tsx`, `src/app/globals.css`, `src/i18n/` and `src/components/LanguageSwitcher.tsx`.

## 1. Scope and hard rules

Files:
- `src/app/[lang]/page.tsx`: rewrite. Keep it an async **Server Component** (`getLocale()`, `getDictionary()`) so the page still prerenders statically.
- `src/app/[lang]/landing.module.css`: new. Put all landing CSS here, including keyframes and pseudo-elements. Do not use Tailwind utilities for this page.
- `src/components/LandingHeader.tsx`: new, `"use client"`. Contains the header, burger, menu state and backdrop.
- `src/components/LandingMotion.tsx`: new, `"use client"`, renders `null`. Handles the animation hooks and the video reduced-motion pause.
- `src/i18n/dictionaries/{en,cs,uk}.ts`: replace the `landing` block (section 12).

Do not touch:
- `layout.tsx`, `globals.css` tokens, the dashboard, API routes, `meta.*`, or `/favicon.ico`.
- The dashboard keeps Geist. Inter and Instrument Serif apply to the landing only.

Content rules:
- One viewport only: header, hero, stats row. No extra sections, cards, forms, pricing or footer beyond the three stats.
- No WebGL, Three.js, Lottie, and no images other than the hero video and the inline SVGs defined here.
- Use exactly one video URL (section 3). Never invent another CDN URL.
- Every visible string comes from the dictionary. No hard-coded copy in TSX, except brand names inside SVG initials.
- Keep the gold credit ("Created by Olga Demianyk"). It must stay on the site and must keep using the existing global `.text-gold` class from `globals.css`. Do not re-implement or restyle the gradient.
- Do not commit.

### Never flash white

`globals.css` already paints `body` `#0d0e10` on the server. On the landing, force pure black with `:has()` so other routes are unaffected:

```css
:global(html):has(.root), :global(body):has(.root) { background: #000000 !important; color: #ffffff; }
.root { background: #000000; color: #ffffff; }
```

## 2. Fonts (next/font, self-hosted automatically)

In `page.tsx`, at module scope:

```ts
import { Inter, Instrument_Serif } from "next/font/google";
const inter = Inter({ subsets: ["latin", "latin-ext", "cyrillic"], variable: "--font-landing-sans", display: "swap" });
const serif = Instrument_Serif({ weight: "400", style: "italic", subsets: ["latin", "latin-ext"], variable: "--font-landing-serif", display: "swap" });
```

Apply `${inter.variable} ${serif.variable}` on the `.root` element.

Font stacks:
- UI, logo, nav, buttons, badge, lede, stats, credit: `var(--font-landing-sans), system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`
- **Only** the `<em>` in the H1: `var(--font-landing-serif), Georgia, "Times New Roman", Times, serif`. Instrument Serif has no Cyrillic, so in `uk` the browser falls back per glyph to Georgia/Times. That is expected.

Base styles, scoped to `.root`:
- `.root`: `-webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale; text-rendering: optimizeLegibility; overflow-x: hidden; position: relative; flex: 1` (the layout body is `flex flex-col`).
- `.root *, .root *::before, .root *::after`: `box-sizing: border-box; margin: 0; padding: 0`.
- Links: `color: inherit; text-decoration: none`. Buttons: `font-family: inherit`.

## 3. Assets (the only ones)

**Hero background video.** Full-bleed, 100% opacity, **no scrim or overlay**:

```
https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260818_072341_50851634-bbc3-4c33-9acc-7647d4db44aa.mp4
```

Markup: `<video className={styles.heroVideo} src="…" autoPlay muted loop playsInline preload="auto" aria-hidden="true" />`
- Styles: `position: fixed; inset: 0; width: 100%; height: 100%; object-fit: cover; z-index: 0; background: #000; pointer-events: none`.
- No poster image. The black background is the fallback.

**Logo mark.** A monochrome version of our infinity mark (`public/infinity-mark.svg`), 22×22, `viewBox="0 0 24 24"`, `fill="none"`, `stroke="currentColor"`, `stroke-width="2"`, `stroke-linecap="round"`, `stroke-linejoin="round"`:

```
M12 12C10.15 10.19 8.14 8.47 5.9 8.47C3.59 8.47 2 9.92 2 12C2 14.08 3.59 15.53 5.9 15.53C8.14 15.53 10.15 13.82 12 12ZM12 12C13.85 10.19 15.86 8.47 18.1 8.47C20.41 8.47 22 9.92 22 12C22 14.08 20.41 15.53 18.1 15.53C15.86 15.53 13.85 13.82 12 12Z
```

**Grain.** `.grain`: `position: fixed; inset: 0; z-index: 100; pointer-events: none; opacity: 0.05; mix-blend-mode: overlay`. Its background is an inline SVG `feTurbulence` data URI (`baseFrequency="0.9"`, `numOctaves="2"`, `stitchTiles="stitch"`) tiled at 160px. This is the only data URI on the page.

## 4. Tokens (on `.root`, default ≈1440px)

```
--bg: #000000        --text: #ffffff      --muted: #9a9a9a     --stat: #d8d8d8
--border: rgba(255,255,255,0.16)          --border-soft: rgba(255,255,255,0.12)
--logo: 15.5px  --logo-mark: 22px  --nav: 14px  --nav-h: 40px
--btn: 13.5px   --btn-h: 40px      --hero-btn-h: 42px
--h1: 48px      --lede: 15.5px     --badge: 12.5px  --stat-size: 13.5px
--header-y: 22px  --header-x: 40px  --stats-x: 72px  --stats-y: 36px
--hero-gap: 85px  --copy-max: 860px --lede-max: 470px
```

## 5. Layer stack and markup

Layers, back to front:
1. html/body black
2. `.heroVideo` (z 0)
3. `.page`: `position: relative; z-index: 1; display: grid; grid-template-rows: auto 1fr auto; min-height: 100vh; min-height: 100dvh`
4. `.grain` (z 100)

Markup:

```
div.root (font variables)
  div.grain
  video.heroVideo
  div.page
    <LandingHeader …strings, locale />  → div.menuBackdrop + header.header
    main.hero#top
    footer.stats (aria-label = t.landing.statsLabel)
  <LandingMotion />
```

## 6. Header (LandingHeader, client)

Layout: `display: grid; grid-template-columns: 1fr auto 1fr; align-items: center; padding: var(--header-y) var(--header-x) 10px; position: relative; z-index: 50`.

### Left: logo

`Link.logo.appear.appear--scale` → `/${locale}`, `aria-label={t.landing.homeAria}`.
- Styles: `display: inline-flex; align-items: center; gap: 9px; justify-self: start; font-size: var(--logo); font-weight: 600; letter-spacing: -0.03em; color: #fff`.
- Content: the mark, then `{brand}<span class="logoSuffix">{brandSuffix}</span>` ("Human" + "-Gated"). The suffix is `font-weight: 400`.

### Center: nav

`nav#site-nav`, `aria-label={t.landing.navLabel}`, `display: flex; align-items: center; gap: 8px; justify-self: center`.

All four links are external GitHub links: plain `<a target="_blank" rel="noopener noreferrer">`.

| Label key | href | appear |
|---|---|---|
| `nav.howItWorks` | `https://github.com/olgachernova37/Matching#the-idea-bind-the-proof-to-the-action-not-the-session` | `appear--scale` |
| `nav.sponsors` | `https://github.com/olgachernova37/Matching#how-each-sponsor-is-load-bearing` | `appear--soft` |
| `nav.security` | `https://github.com/olgachernova37/Matching#security-properties-each-with-a-test` | `appear--scale` |
| `nav.gatewayApi` | `https://github.com/olgachernova37/Matching#try-the-gateway-as-an-agent-would` | `appear--soft` |

Each link is a **liquid-metal pill**:
- Box: `height: var(--nav-h); padding: 0 18px; border-radius: 7px; overflow: hidden; position: relative; display: inline-flex; align-items: center`.
- Paint: `border: 1px solid rgba(198,198,198,0.55)`, `background: linear-gradient(105deg, #050505 0%, #2a2a2a 48%, #4a4a4a 100%)`, color `#f3f3f3`.
- Text: `font-size: var(--nav)`, weight 400, `letter-spacing: -0.01em`, `white-space: nowrap`.
- Transition: background, border-color and box-shadow at 0.35s ease.
- Shine `::before`: `linear-gradient(115deg, transparent 30%, rgba(255,255,255,0.16) 50%, transparent 70%)`. Idle `translateX(-120%)`, hover `translateX(120%)`, 0.6s ease.
- Hover: border `rgba(235,235,235,0.9)`, background `linear-gradient(105deg, #111 0%, #3a3a3a 45%, #6a6a6a 100%)`, `box-shadow: 0 0 18px rgba(200,210,230,0.18)`.

### Right: switcher and CTA

`div.headerEnd` (`display: flex; align-items: center; gap: 14px; justify-self: end`) contains:
1. The existing `<LanguageSwitcher locale label switchTo />`. Restyle it only through a wrapper class: color `#d8d8d8`, active link `#fff`.
2. `Link.btn.btnSolid.headerCta.appear.appear--scale` with text `openConsole`, linking to `/${locale}/dashboard`.

The credit is **not** in the header. With the nav centered there is no room for it next to the switcher and CTA; it lives in the hero (section 8).

### Burger

Hidden at ≥901px (`display: none`), `display: grid; place-content: center` on phone.
- Box: 42×42, `border-radius: 6px`, `border: 1px solid var(--border)`, `background: rgba(8,8,8,0.55)`, `z-index: 60`.
- Attributes: `aria-controls="site-nav"`, `aria-expanded`, `aria-label` = `menuOpen` or `menuClose`.
- Bars: three white bars, 16×1.5px, gap 5px, `border-radius: 1px`.
- Hover: border `rgba(255,255,255,0.32)`, background `rgba(255,255,255,0.05)`.
- Open: bar 1 `translateY(6.5px) rotate(45deg)`, bar 2 `opacity: 0`, bar 3 `translateY(-6.5px) rotate(-45deg)`. Transform 0.25s, opacity 0.2s.

Menu state:
- React state renders `data-menu-open` on the header/backdrop.
- A `useEffect` toggles `document.body.classList` `landing-menu-open` (`overflow: hidden`) and removes it on unmount.
- The menu closes on: nav link click, Escape, and `matchMedia("(min-width: 901px)")` becoming true.

## 7. Buttons (shared liquid-glass language)

### `.btn` (base)

- Layout: `position: relative; isolation: isolate; overflow: hidden; display: inline-flex; align-items: center; justify-content: center; height: var(--btn-h); padding: 0 16px; border-radius: 6px`.
- Text: `font-size: var(--btn); font-weight: 500; letter-spacing: -0.02em; line-height: 1; white-space: nowrap; cursor: pointer`.
- Transitions: 0.35s on background, border-color, box-shadow, color and filter.
- Shine `::after`: `linear-gradient(115deg, transparent 20%, rgba(255,255,255,0.45) 48%, transparent 76%)`. Idle `translateX(-130%)`, hover `translateX(130%)`, 0.65s ease.

### Solid

- Rest: `background: linear-gradient(180deg, #ffffff 0%, #e7e7e7 48%, #cfcfcf 100%)`, `color: #111`, `border: 1px solid #fff`, `box-shadow: inset 0 1px 0 rgba(255,255,255,0.95)`.
- Hover: background `linear-gradient(180deg, #fff 0%, #f3f6ff 42%, #d5def2 100%)`, border `#f2f6ff`, `box-shadow: inset 0 1px 0 #fff, 0 0 22px rgba(186,208,255,0.35), 0 8px 18px rgba(255,255,255,0.12)`.
- Hero solid hover glow: `0 0 26px rgba(186,208,255,0.4), 0 8px 18px rgba(255,255,255,0.14)`.

### Ghost (hero only)

- Rest: `background: linear-gradient(135deg, rgba(255,255,255,0.12), rgba(0,0,0,0.5) 46%, rgba(150,170,200,0.1))`, `color: #fff`, `border: 1px solid rgba(198,198,198,0.55)`, `box-shadow: inset 0 1px 0 rgba(255,255,255,0.12)`, `backdrop-filter: blur(16px)` plus the `-webkit-` prefix.
- Hover: background `linear-gradient(135deg, rgba(210,225,255,0.18), rgba(0,0,0,0.35) 48%, rgba(180,195,220,0.16))`, border `rgba(220,230,255,0.8)`, `box-shadow: inset 0 1px 0 rgba(255,255,255,0.22), 0 0 24px rgba(170,200,255,0.28)`.

Hero action buttons: `height: var(--hero-btn-h); padding: 0 18px`.

## 8. Hero (bottom-centered, NOT vertically centered)

`.hero`: `display: flex; align-items: flex-end; justify-content: center; padding: 8px 24px var(--hero-gap); min-height: 0`.

`.heroCopy`: `position: relative; z-index: 1; display: flex; flex-direction: column; align-items: center; text-align: center; max-width: var(--copy-max); width: 100%`.

### Badge

`.badge.appear.appear--pop`, text `badge`.
- Box: `display: inline-flex; align-items: center; gap: 8px; margin-bottom: 22px; padding: 9px 15px; border: 0; border-radius: 5px`.
- Paint: `background: linear-gradient(90deg, #7d7d7d 0%, #2a2a2a 52%, #0a0a0a 100%)`, color `#f2f2f2`.
- Text: `font-size: var(--badge)`, weight 400, `letter-spacing: -0.01em`.
- Leading `.badgeStar`: 18×20 white sparkle, `filter: drop-shadow(0 0 3px rgba(255,255,255,0.45))`, `aria-hidden`, path:

```
M12 2.6C12.55 2.6 12.88 3.15 13.08 4.7c.62 4.7 1.52 5.6 6.22 6.22 1.55.2 2.1.53 2.1 1.08s-.55.88-2.1 1.08c-4.7.62-5.6 1.52-6.22 6.22-.2 1.55-.53 2.1-1.08 2.1s-.88-.55-1.08-2.1c-.62-4.7-1.52-5.6-6.22-6.22C3.15 12.88 2.6 12.55 2.6 12s.55-.88 2.1-1.08c4.7-.62 5.6-1.52 6.22-6.22C11.12 3.15 11.45 2.6 12 2.6Z
```

### H1

- Styles: Inter 500, `font-size: var(--h1)`, `letter-spacing: -0.045em`, `line-height: 1.12`, `#fff`, flex column, centered.
- Two masked lines:
  - Line 1: `{headline.before} <em>{headline.em}</em> {headline.after}`
  - Line 2: `{headline.bottom}`
- `.headlineLine`: `display: block; overflow: hidden; padding: 0.06em 0.15em 0.14em`.
- `em`: serif stack, italic 400, `font-size: 1.08em`, `letter-spacing: -0.03em`, color **`#9a9a9a`** (not white).

### Lede

`.lede.appear.appear--soft`, text `lead`.
- Styles: `max-width: var(--lede-max); margin-top: 18px; color: #9a9a9a; font-size: var(--lede); font-weight: 400; line-height: 1.55; letter-spacing: -0.015em`.

### Actions

`.heroActions`: `display: flex; flex-wrap: wrap; justify-content: center; gap: 10px; margin-top: 26px`.
1. `Link.btn.btnSolid.appear.appear--btn` with text `openConsole`, linking to `/${locale}/dashboard`.
2. `a.btn.btnGhost.appear.appear--side` with text `viewSource`, linking to `https://github.com/olgachernova37/Matching` (`target="_blank" rel="noopener noreferrer"`).

### Credit (gold signature, under the actions)

```tsx
<p className={`${styles.credit} ${styles.appearSoft}`} data-appear style={{ "--d": "1.18s" } as React.CSSProperties}>
  <span className="text-gold">{t.landing.credit}</span>
</p>
```

- `.credit`: `margin-top: 22px; font-size: 13px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.16em; line-height: 1.4`. Uses the Inter stack.
- The animation lives on the `<p>` and the gold lives on the inner `<span>`. They must stay separate: the `[data-in]` and reduced-motion rules set `filter: none`, which would remove `.text-gold`'s drop-shadow glow if both were on one element. Never put `data-appear` on the `.text-gold` element, and never target `.text-gold` from the reduced-motion reset.

## 9. Stats footer

`.stats`: `display: flex; align-items: center; justify-content: space-between; gap: 24px; padding: 0 var(--stats-x) var(--stats-y); padding-bottom: max(var(--stats-y), env(safe-area-inset-bottom)); color: var(--stat)`.

Each `.stat.appear.appear--stat`: `display: inline-flex; align-items: center; gap: 14px; font-size: var(--stat-size); letter-spacing: -0.015em; white-space: nowrap`. Icons are 20×20, `aria-hidden`; the wide icon is 38×21.

### 1. Dual-pill icon (`stats.binding`)

`viewBox="0 0 24 24"`. Meaning: proof bound to action.
- Left rect: `x=3.4 y=2.6 w=7.2 h=18.8 rx=3.6`, fill linear gradient `#ffffff` @0.38 → `#3a3a3a` @0.62 (`x1=3 y1=2 x2=14 y2=22`, userSpaceOnUse).
- Right rect: `x=13.4 y=2.6`, same size, inverted gradient `#3a3a3a` @0.38 → `#ffffff` @0.62.
- Connector: `x=9.2 y=10.9 w=5.6 h=2.2 rx=1.1`, fill `#4a4a4a`.
- Give gradient ids a static prefix (`hg-pill-a`, `hg-pill-b`). They are unique on this page.

### 2. Receipt tile (`stats.receipt`)

- Tile: white rounded square `x=2.4 y=2.4 w=19.2 h=19.2 rx=6.2`, fill `#ffffff`.
- Check mark: `#111`, `stroke-width="1.85"`, round caps and joins, `fill="none"`, path `M7.9 12.3l2.75 2.75L16.1 9.4`.

### 3. Three initials (`stats.sponsors`)

`viewBox="0 0 40 22"`, class `statIconWide`. Initials only, no sponsor logos.
- Dark circle `cx=10.2 cy=11 r=9.2`, fill `#2b2b2b`, white `G`.
- White circle `cx=20.2`, same r, black `W`.
- Circle `cx=30.2`, fill `#7ab8f5` (our `--brand`), `#0d0e10` `B`.
- Letters: Inter 700, `font-size=10`, `text-anchor=middle`, `y=14.6`.

## 10. Entrance motion (exact)

`.appear` resting opacity is **1**, so the page is never blank if animations fail.
- `animation-duration: 1.05s; animation-fill-mode: both; animation-timing-function: cubic-bezier(0.16, 1, 0.3, 1); animation-delay: var(--d, 0.08s)`.
- Set `--d` inline via `style={{ "--d": "0.42s" } as React.CSSProperties}`.
- `.isIn` (and `.heroVideo.isIn`): `animation: none; opacity: 1; transform: none; clip-path: none; filter: none`.
- Because class names are hashed, LandingMotion adds the class by selecting `[data-appear]` and adding a `data-in` attribute. Style `[data-in]` as the `.is-in` rules.

| Element | Modifier | `--d` |
|---|---|---|
| Logo | scale | 0.08s |
| Nav 1 / 2 / 3 / 4 | scale / soft / scale / soft | 0.16 / 0.28 / 0.40 / 0.52s |
| Header CTA + switcher + burger | scale | 0.34s |
| Badge | pop | 0.22s |
| H1 line 1 / line 2 | mask | 0.42s / 0.62s |
| Lede | soft | 0.82s, duration **1.25s** |
| Solid CTA | btn | 0.96s |
| Ghost CTA | side | 1.10s |
| Credit (wrapper `<p>` only) | soft | 1.18s |
| Stat 1 / 2 / 3 | stat | 1.12 / 1.28 / 1.44s |
| Hero video | video (opacity 0→1, 1.4s ease) | 0s |

Keyframes (all end at opacity 1 and identity transform):
- `in-scale`: opacity 0, `scale(0.84)`
- `in-soft`: opacity 0, `translateY(14px)`
- `in-mask`: opacity 0, `translateY(40%)`, clipped by `.headlineLine`
- `in-pop`: 0% opacity 0 `scale(0.9)` → 70% `scale(1.03)` → 100% `scale(1)`
- `in-btn`: opacity 0, `translateY(18px) scale(0.94)`
- `in-side`: opacity 0, `translateX(22px)`
- `in-stat`: opacity 0, `translateY(20px)`
- `in-star` on `.badgeStar`: 0.9s, delay 0.28s, both. `scale(0.2) rotate(-50deg)` → 65% `scale(1.2) rotate(8deg)` → rest
- `in-em` on `h1 em`: 1.2s, delay 0.72s, both. `opacity 0.35; filter: blur(4px)` → sharp

LandingMotion (`useEffect`, runs once):
1. Each `[data-appear]` gets its own `animationend` listener (`{ once: true }`, ignore bubbled events where `e.target !== el`), which sets `data-in`.
2. After two `requestAnimationFrame`s: if no element's `getAnimations()` has anything `running` or `finished`, set `data-in` on every `[data-appear]` and the video.
3. If `matchMedia("(prefers-reduced-motion: reduce)")` matches: pause the video and set `currentTime = 0`.
4. Clean up listeners and cancel the rAFs on unmount.

`@media (prefers-reduced-motion: reduce)`:
- `.root *, .root *::before, .root *::after { transition: none !important; animation: none !important }`.
- Force `[data-appear]`, `.heroVideo`, `h1 em` and `.badgeStar` to `opacity: 1; transform: none; clip-path: none; filter: none`.
- Do **not** include `.text-gold` in that reset. Its drop-shadow must survive.

## 11. Responsive (copy these breakpoints)

- **≥1600:** logo 17 / mark 24 / nav 15 / nav-h 44 / btn 15 / btn-h 44 / hero-btn 48 / h1 **64** / lede 18 / badge 13.5 / stat 15 / header 28×64 / stats 96×44 / copy 980 / lede-max 540. Nav padding `0 20px`. Badge mb 26, lede mt 22, actions mt 30 with gap 12. Icons 22, wide icon 45×24. Credit font 14, margin-top 26.
- **≥1920:** logo 18 / mark 26 / nav 16 / nav-h 48 / btn 16 / btn-h 48 / hero-btn 52 / h1 **76** / lede 20 / badge 14.5 / stat 16 / header 32×80 / stats 120×52 / copy 1120 / lede-max 620. Nav gap 10, nav padding `0 22px`, buttons padding `0 22px`, badge padding `10px 15px`, wide icon 48×26. Credit font 15, margin-top 30.
- **≥2560:** h1 **88**, lede 22, header-x 120, stats-x 160, copy 1280, lede-max 680.
- **1280–1599:** h1 54, lede 16, header-x 48, stats-x 80, copy 900.
- **901–1279:** logo 15, nav 13, nav-h 36, btn 13, btn-h 38, hero-btn 40, h1 **42**, lede 15, badge 12, stat 12.5, header 16×28, stats 36×28, hero-gap 64, copy 760, lede-max 440. Nav padding `0 14px`. Badge mb 16, lede mt 14, actions mt 20. Czech and Ukrainian strings are longer, so in this range stats may use `white-space: normal` with `max-width: 30%`.
- **≥901 and max-height 850:** header-y 14, stats-y 24, hero-gap 48, h1 40. Badge mb 12, lede mt 12, actions mt 16, credit margin-top 14.
- **≥901 and max-height 720:** h1 34, lede 14, hero-gap 32, stats-y 18, nav-h 30, btn-h 34, hero-btn 36, badge mb 8. Credit font 12, margin-top 10.
- **≥901 desktop lock:** `:global(html):has(.root), :global(body):has(.root) { height: 100%; overflow: hidden }` and `.page { height: 100vh; height: 100dvh; overflow: hidden }`. One frame, **no scroll**.

### ≤900 (phone)

Page and header:
- No viewport lock: html/body `height: auto; overflow-y: auto`.
- Header: `grid-template-columns: 1fr auto auto`, gap 8, safe-area padding. Logo, CTA and burger get `z-index: 80`.
- Move LanguageSwitcher into the open menu, below the links. Hide it from the header row.

Full-screen menu:
- `.menuBackdrop`: `display: block; position: fixed; inset: 0; z-index: 40; background: rgba(8,8,8,0.42)`. Idle `opacity: 0; visibility: hidden`. Open: opacity 1 plus **`backdrop-filter: blur(24px)`**, 0.28s.
- Nav: becomes a full-viewport column, `z-index: 45`, transparent, centered, gap 12, `padding: 96px 22px 32px; padding-top: max(96px, calc(env(safe-area-inset-top) + 88px))`. Hidden unless open.
- Links: full width, height 56, `font-size: 19px`, `border-radius: 10px`.
- `body.landing-menu-open { overflow: hidden }` (global class).

Hero and stats:
- Hero padding `20px 20px 64px`, still `align-items: flex-end`.
- Stats become a **column**, centered, gap 16, `white-space: normal`.
- Copy and lede max-width 100%.
- Credit: font 12.5, margin-top 20, `text-align: center`.
- Tokens: logo 16, btn 15 / 46, hero-btn 48, h1 **36**, lede 16.5, badge 13.5, stat 15, header 16×18, stats 20×28, hero-gap 36.

### ≤560

h1 34, lede 16, header-x 16. Hero actions become a **column** and buttons get `width: 100%`. Credit font 12, letter-spacing 0.12em.

## 12. Dictionary: new `landing` block

Replace the whole `landing` object in all three dictionaries. `en.ts` defines the type, so cs/uk must match exactly.

First grep `landing.` across `src/` and confirm no other file reads the old keys that are being removed (`eyebrow`, `steps`, `mark*`, `flowLabel`, `builtFor`, `headlineTop`, `headlineBottom`). **Keep** `credit` and `openConsole` with their existing cs/uk translations.

```ts
// en
landing: {
  brand: "Human", brandSuffix: "-Gated", homeAria: "Human-Gated home",
  credit: "Created by Olga Demianyk",
  navLabel: "Primary",
  nav: { howItWorks: "How It Works", sponsors: "Sponsors", security: "Security", gatewayApi: "Gateway API" },
  openConsole: "Open Console",
  viewSource: "View on GitHub",
  badge: "Selfie Check · The Graph · x402",
  headline: { before: "Your", em: "AI agent", after: "can't spend", bottom: "until a human approves." },
  lead: "Live on-chain evidence scores the risk. Every risky action waits for a World ID Selfie Check bound to that exact payload.",
  statsLabel: "Key facts",
  stats: { binding: "1 proof per exact action", receipt: "Single-use, 5-minute receipts", sponsors: "Built on The Graph, World & Bazantic" },
  menuOpen: "Open menu", menuClose: "Close menu",
},
// cs
landing: {
  brand: "Human", brandSuffix: "-Gated", homeAria: "Human-Gated – domů",
  credit: /* keep existing */,
  navLabel: "Hlavní navigace",
  nav: { howItWorks: "Jak to funguje", sponsors: "Partneři", security: "Bezpečnost", gatewayApi: "Gateway API" },
  openConsole: /* keep existing */,
  viewSource: "Zobrazit na GitHubu",
  badge: "Selfie Check · The Graph · x402",
  headline: { before: "Váš", em: "AI agent", after: "nic neutratí,", bottom: "dokud to neschválí člověk." },
  lead: "Živá on-chain data určí riziko. Každá riziková akce čeká na World ID Selfie Check navázaný přesně na ni.",
  statsLabel: "Klíčová fakta",
  stats: { binding: "1 důkaz na 1 konkrétní akci", receipt: "Jednorázová potvrzení na 5 minut", sponsors: "Postaveno na The Graph, World a Bazantic" },
  menuOpen: "Otevřít menu", menuClose: "Zavřít menu",
},
// uk
landing: {
  brand: "Human", brandSuffix: "-Gated", homeAria: "Human-Gated — на головну",
  credit: /* keep existing */,
  navLabel: "Основна навігація",
  nav: { howItWorks: "Як це працює", sponsors: "Партнери", security: "Безпека", gatewayApi: "Gateway API" },
  openConsole: /* keep existing */,
  viewSource: "Переглянути на GitHub",
  badge: "Selfie Check · The Graph · x402",
  headline: { before: "Ваш", em: "AI-агент", after: "нічого не витратить,", bottom: "доки людина не схвалить." },
  lead: "Живі on-chain дані визначають ризик. Кожна ризикована дія чекає на World ID Selfie Check, прив'язаний саме до неї.",
  statsLabel: "Ключові факти",
  stats: { binding: "1 доказ — 1 конкретна дія", receipt: "Одноразові квитанції на 5 хвилин", sponsors: "Працює на The Graph, World і Bazantic" },
  menuOpen: "Відкрити меню", menuClose: "Закрити меню",
},
```

Pass only the strings LandingHeader needs as props. They are plain strings, so they serialize.

## 13. Follow-up in DEMO.md

Scene 1 says to scroll down to the six steps, which no longer exist. Replace that instruction with: "Покажи головну сторінку: відео у фоні, заголовок, золотий підпис і три факти внизу. Нічого не прокручуй." Keep the rest of the scene unchanged.

## 14. Verify before reporting

1. `npx tsc --noEmit`, `npm run lint`, `npm test`, `npm run build`. The landing must still be listed as static (○/●) in the build output.
2. `npm run dev`. Check `/en`, `/cs` and `/uk` at 1440×900, 1024×768, 1920×1080 and 390×844:
   - no scroll on desktop, and nothing overlaps or clips in cs/uk;
   - the video plays with no overlay;
   - the gold credit is visible under the buttons in all three locales, with the gradient and glow intact after the entrance animation ends;
   - the burger opens and closes (Escape, link click, resize to ≥901);
   - "Open Console" reaches the dashboard;
   - with reduced motion emulated, everything is visible (the credit still gold) and the video is paused.
3. Open `/en/dashboard` and confirm it is visually unchanged (still Geist, `#0d0e10`, scrolls normally).
4. Report which checks passed, with any failures verbatim. Do not commit.
