# Remix — Insider Madeira → Meneses Group (luxury real estate)

Phase 1 (re-skin) only, per the remix-site skill. Output:
`remix/meneses-group/site/` — a sibling copy of the original clone, so
`../../site/` (the Insider Madeira clone) stays untouched as its own
reference.

## Environment adaptation (read this first)

This machine has no `node`/`npm`, so the skill's literal tooling
(`scripts/tokenize-css.js`, `apply-overrides.js`, `gallery.js`,
`tweak-panel.js`) couldn't run. Phase 0 "tokenize" was done by hand instead:
the clone's CSS already routed its measured values through custom properties
(`--ink`, `--paper`, `--beige`, etc.); I added the brand knobs
(`--rx-accent`, `--rx-accent-ink`) the same way. It's a real knob list, just
not machine-generated — see `site/css/styles.css` header comment.

## Brand

- **Name:** Meneses Group.
- **Logo:** reused the verified-transparent Meneses Group mark from the
  `dewaltmenesesgroup.com` rebuild earlier this session (same session, same
  team) — not generated. Same CSS trick as that site: white ink as-is on the
  transparent/dark nav, `filter:brightness(0)` flips it to dark ink once the
  nav goes solid on scroll, and in the footer.
- **Accent color:** `#153E35` (deep green) + `#DFDCD0` (text-on-accent) —
  pulled from the *same* dewaltmenesesgroup.com rebuild rather than invented,
  so the two properties read as one consistent brand rather than two
  unrelated sites. Applied to buttons, eyebrows, testimonial names, and the
  step numbers — the neutral ink/paper/beige palette underneath is otherwise
  untouched.
- **Fonts:** kept Fraunces (headings) / Inter (body) — these were already
  free substitutes for the source's licensed fonts (see the clone's
  TEARDOWN.md), and the pairing suits luxury real estate as well as it suited
  luxury travel, so no further swap was needed.

## Copy

Every text node replaced, section shapes kept (same eyebrow/headline/sub/CTA
pattern, same card counts):

| Original section | Remixed as |
|---|---|
| Hero: Madeira gateway | Hero: LA/Miami gateway |
| About: "Essence of Our Legacy" (travel) | About: same eyebrow, team bio — reused verbatim from the dewaltmenesesgroup.com clone's real agent-bio copy |
| Why work with Insider (3 cards) | Why work with Meneses Group: Local Market Expertise / Off-Market Access / White-Glove Representation |
| "A Day with Insider" (4 time-of-day video cards) | **Featured Listings** (4 real property cards — see Assets) |
| CTA: plan your journey | CTA: find your next address |
| Insider Tips (4 blog cards) | Market Insights (4 cards) — original placeholder copy in the source's voice/format, not real published articles |
| How We Plan Your Trip (4 steps) | How We Guide Your Purchase or Sale (4 steps) |
| Testimonials (4 quotes) | **Placeholder quotes, flagged in the HTML source** — see Guardrail note below |
| Suggestion gallery (5 lifestyle photos) | More Listings gallery (5 more real properties) |
| Footer | Real contact info reused verbatim from the dewaltmenesesgroup.com clone (phone, email, DRE numbers, address) — all genuinely the team's own |

## Assets — all real, nothing generated

Every image and the hero video are real property photography/footage
downloaded earlier this session from the team's own live site
(dewaltmenesesgroup.com) and the user's own Desktop file (House Video.mp4) —
not Higgsfield-generated placeholders, because real assets were already on
hand:

- Hero: `house-video.mp4` (the user's own footage, supplied earlier this session)
- Featured Listings (4 cards): Brentwood Melhill Estate, Palacio Del Solano, 1401 Bel Air Road, Kempinski Residences Miami
- About section: Villa Amodei
- More Listings gallery (5): Foxtail Ranch, Oak Canyon Ranch, 5192 Parkway Calabasas, 1111 Bel Air Pl, Kempinski Residences Miami (repeated — see Known gaps)

## Guardrail note — testimonials are placeholders, not real reviews

The source's 4-testimonial section was kept structurally (same card count/
layout) but the quotes are **written placeholders**, not real client
feedback — I don't have real Meneses Group client testimonials to pull from.
Attribution is deliberately generic ("Buyer — Brentwood, Los Angeles" rather
than an invented full name) specifically so nothing here could be mistaken
for a fabricated review of a real person. **Swap these for real client
quotes before this goes live** — flagged in an HTML comment right above the
section too.

## Structural skeleton kept from the source (as the skill requires disclosing)

- Section order and count (11 sections, same as the Madeira clone)
- The "Featured Listings" horizontal scroll-jacked gallery is the same
  mechanic as the source's "A Day with Insider" — sticky-pin + scroll-progress
  `translateX`, reproducing the GSAP ScrollTrigger scrub behavior measured
  off the live insidermadeira.com site — just pointed at property cards
  instead of time-of-day activity cards.
- Testimonial row: same CSS scroll-snap mechanic, new (placeholder) copy.
- Nav scroll-state behavior (transparent → solid on scroll) unchanged.

## Verification this run

- All 12 `<img>` + 1 `<video>` confirmed loading (0 failures), video
  `readyState 4`.
- No leftover "Madeira"/"Insider"/"Dewalt" branding in body text beyond two
  false positives (the common word "insider" used normally, and "Dennis
  Dewalt" — the real co-agent's name, which is meant to stay per this
  session's earlier "keep Dennis Dewalt as agent, only rename the team
  brand" decision).
- Screenshots: hero, about (scrolled-nav state), and the Featured Listings
  scroll-jack gallery mid-scroll — all matched expectations. Same environment
  constraint as both clones this session (no Playwright, browser pane
  visibility) — no automated pixel diff.

## How to view it

```bash
python3 -m http.server 8793 --directory /Users/brandonmeneses/output/insidermadeira.com/remix/meneses-group/site
```
then open http://localhost:8793.
