# Grand Blvd Studio — internal notes

Local-business lead-gen/web-presence business run out of Classic Styles Salon & Day Spa on
Grand Blvd, New Port Richey, FL. Kept in its own project folder, separate from Goodwise
Essentials, on purpose.

## What this project actually is (corrected 2026-11-08)

This repo IS the real, already-live `grandblvdstudio.com` site (GitHub repo
`arenkeough32-dev/grandblvd-studio`, cloned here with full history). An earlier session built a
much simpler from-scratch page here before discovering that a far more developed site already
existed and was already live. That simple draft has been discarded; this clone is the one and
only working copy going forward. Don't rebuild `index.html` from scratch again — edit it in place
and push.

The real site already covers, with real engineering (tests, validation, accessibility, a
92/100/100/100 Lighthouse profile): missed-call text-back, a phone assistant, review requests,
Google profile care, a `/start/` enquiry form (SMS/email, validated, tested), field-notes
articles, a sample report, a free-homepage-preview flow, and real pricing ($149/$297/$497 per
month, $249/$449/$649 one-time websites). Classic Styles Salon & Day Spa
(classicstylesdayspas.com) is the real case study/home base.

"Studio Bright" (mentioned in a Kimi addendum) is a **different, unrelated** project — the
YouTube channel — not this business. Don't conflate the two.

## Structure

- Repo root — the live site itself (`index.html`, `assets/`, `field-notes/`, `/start/`, etc.) —
  this IS what deploys to grandblvdstudio.com via GitHub Pages + CNAME.
- `internal/docs/` — Aren's own process docs (VSL script, call-flow SOP). Working drafts for
  Aren's own recording/outreach use, not website content.
- `internal/kimi/` — raw source files from Kimi, kept for reference/history only.

## Status (2026-11-08)

- v2 shipped to the live site: a 3-question "what's working / what isn't" quiz (hero-adjacent,
  pure vanilla JS, nothing stored/sent anywhere), hover/tap reveal on the back of the 5 existing
  services cards (problem-framed one-liners), a light-mode proof ticker reusing the site's own
  marquee pattern (the 3 verified example stories), 2 new FAQ entries (+ matching FAQPage JSON-LD),
  and an off-by-default Tawk.to loader (`assets/tawk.js`, gated on `window.GBS_TAWK_ID`).
- Deliberately NOT done, and why:
  - **Calendly embed** — no link yet (Aren said he'd send one; never arrived). CTAs still point at
    the existing sms:/`/start/` flow. The quiz result button has an HTML comment marking exactly
    where to swap in the Calendly link once it exists.
  - **Tawk.to chat widget** — needs Aren to create a free account (tawk.to, ~2 min, no card) and
    paste the Property ID into the `GBS_TAWK_ID` line near the end of `index.html`. Left off by
    default so nothing third-party loads until he does.
  - **Tally.so fallback form** — skipped. The site already has a working, tested `/start/` form
    (SMS + mailto, validated, offer/source tracked) that does the same job with zero new accounts.
  - **GSAP / any CDN library** — deliberately not added. The existing site is hand-built,
    zero-dependency JS with its own scroll-reveal (`.reveal`), tilt and marquee systems; new
    sections reuse those instead of importing a different stack.
  - Kimi's "6-card services grid" became flip-backs on the 5 *existing* cards instead of a 7th
    duplicate grid, to avoid two competing "what we fix" sections on one page.
- A-01 (whether the footer shows "at Classic Styles, 4116 Grand Blvd") was resolved upstream in
  the live site already — it has no address line in the footer at all currently (Option A).
