# Branding

This is an Axonify dashboard made by Biz Group. Axonify green leads. The Biz Group logo colours are quiet secondary accents.

## Colours

| Colour | Value | Where it is used |
|---|---|---|
| Axonify green | `#79C753` (dark mode `#8BD866`) | Buttons, the active menu item, positive change, participation, health |
| Biz purple | `#682685` (dark mode `#B67CD6`) | Knowledge and learning, and anything internal to the Biz team |
| Biz orange | `#EF7922` (dark mode `#F79646`) | Engagement and frequency |
| Biz grey | `#6A6869` | The logo wordmark only |

Red and amber stay reserved for status (Critical, At Risk). Orange is for dots, bars and glows. It is too pale to carry text.

## The Rule

A measure keeps one colour everywhere, on KPI tiles and on charts, so a reader learns it once.

- Participation, people and health are **green**.
- Knowledge and learning measures are **purple**.
- Engagement, frequency and time on the platform are **orange**.

`src/lib/accent.ts` holds the mapping. `accentFor()` serves the team pages and `accentForKpi()` serves the client dashboards.
Chart series take their colours from `PALETTE` in `src/components/charts/charts.tsx`, in the same order: green, purple, orange.

## Where The Biz Brand Appears

- The logo: favicon, home-screen icon, sidebar, sign-in pages, client dashboard rail (`src/components/brand/brand-logo.tsx`).
- A three-circle mark and "A Biz Group dashboard for Axonify" in the sidebar and on the account pages.
- A short purple, green and orange bar under every page title (`main h1::after` in `src/app/globals.css`).
- Faint purple and orange tints at the corners of the page background.
- The **Internal** menu group and the `biz` badge tone, for things only the Biz team sees.
- The link preview image, the browser theme colour and the home-screen manifest.
- The invitation, reset and confirmation emails (`docs/email-templates`, applied in the Supabase dashboard).

## Adding Something New

- Pick the accent from the measure it shows, not from taste.
- Use `ACCENT[accent]` from `src/lib/accent.ts` for dots, bars and glows rather than writing a colour in.
- Keep Axonify green the strongest colour on any screen.
