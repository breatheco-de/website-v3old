---
name: Font weights in section components
description: Why font-bold/extrabold/black often has no visual effect in components, and the correct pattern to fix it.
---

## The rule
Never use `font-sans` explicitly on elements that need bold/extrabold/black weights. Use `font-inter` instead, or let elements inherit naturally without a font-family class.

**Why:** The mockup sandbox uses `--font-sans: 'Inter'` (full 100–900 range). Production uses `--font-sans: 'Archivo'` which only has weights 400 and 500 loaded. When a component forces `font-sans` on an element, Archivo is used and all heavier weights (600–900) look identical via browser synthesis.

**How to apply:**
- For large display text (hero titles, big prices, section headers) that needs bold weights: add `font-inter` class — Inter Variable is loaded with full 100–900 range.
- For headings (h1–h4) without an explicit font-family class: the global CSS rule applies `font-heading` (Lato, has 300/400/700) automatically — no override needed.
- Never add `font-sans` to a wrapper div or to individual elements unless the text only needs 400/500 weight.
- Never add `font-sans` to an h1 — it overrides the global `h1 { font-family: var(--font-heading) }` rule that would give Lato 700.
- For the RichTextContent title pattern (allowing RTE to control desktop font-size): follow HeroCredibility — `font-inter` on the h1 wrapper, mobile strip font-size + fixed size, desktop full dangerouslySetInnerHTML.

**Reference components that do it correctly:**
- `HeroOrbit.tsx` — `font-inter font-black` on large title
- `BannerMarqueeBadges.tsx` — `font-inter font-black` on large title
- `HeroCredibility.tsx` — `font-inter` on h1, dangerouslySetInnerHTML pattern for RTE
