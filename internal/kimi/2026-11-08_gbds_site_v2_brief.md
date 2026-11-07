# GBDS LANDING PAGE — V2 UPGRADE BRIEF
Kimi · 8 Nov 2026 · All free-tier, static, mobile-first. Visitors never see the word "AI" — features just feel alive.

## 1. New sections (in order, above the footer)
1. HERO (keep current copy) + subtle scroll-in animations (fade-up per block, CSS or GSAP via CDN — free).
2. INTERACTIVE "WHAT'S BROKEN?" CHECKER — a 3-question mini quiz:
   Q1 "When someone Googles your shop, what do they find?" (options: right info / wrong or old hours / wrong address / not sure)
   Q2 "When did your last new Google review land?" (this week / this month / can't remember)
   Q3 "Do you have a page that's fully yours?" (yes / no / what's that)
   RESULT logic: any "wrong/old/not sure/can't remember" → recommend the FREE 10-minute check-up button (Calendly). "No page" adds line "Most owners in your spot start with the $49/month care once they see the list." — recommendation text only, never prices beyond the care plan mention, and only in the result card, not the opener.
   Output card: one sentence summary + book button + "or text (727) 312-7758".
3. "WHAT WE FIX" SERVICES GRID — six animated cards (hover/tap flip): wrong hours online · reviews that stopped · one listing pointing wrong · no page of your own · competitors outranking you · no time to watch it. Each card back = one line of the fix. This is "every service we offer" in visitor language.
4. LIVE CHAT widget (free): Tawk.to free plan — no card, unlimited agents, caps around 100 visitors/mo on free; label it "Questions? Text-style chat with Aren's desk." If Tawk requires an account, Aren creates it (2 min) OR fallback: hide chat, keep the text number CTA prominent. Backup AI-flavored free option: Botpress free tier (2,000 msgs/mo) loaded with the 12 email hooks + FAQ — only if Tawk is rejected; never label it "AI" to visitors.
5. SOCIAL PROOF TICKER — slow auto-scroll strip: the three verified example stories (wrong-street grooming shop / evening-hours restaurant / 29-years-4-reviews spa) rotating as one-line quotes with town names.
6. FAQ accordion (4 items): How does the free check-up work? · How long does a page take? · What if I already have a site? · Do I have to sign a contract? — answers in Aren's plain voice from the refined pack.
7. FINAL CTA (current one) repeated after FAQ.

## 2. Visual bar
- Motion: gentle only — fade/slide on scroll, card flips, ticker scroll. No parallax nausea, nothing over 300ms.
- Palette: keep cream/copper/charcoal from the wireframe. Fonts: one serif headline + one sans body (system fonts fine).
- Performance: everything inline or single CDN; page must still load fast on a phone on cellular.
- Mobile: quiz = full-width stacked; chat widget must not cover the text-number CTA (move widget bubble up-left on mobile or shrink).

## 3. Wiring (free)
- Calendly free embed on both buttons (link arrives separately).
- Form fallback: if Calendly isn't ready, button scrolls to a 4-field form (Tally.so free embed → email to Aren) — fields per call-flow doc §3.
- Tally also free, no card.
- Everything else: no accounts, no keys.

## 4. Explicitly NOT in v2
No paid APIs · no domain purchase · no SMS automation · no stock-photo hero (keep the clean type-led look) · no dark patterns (fake counters, fake urgency timers — real scarcity only).

## 5. After v2 ships (queue)
- VSL video embeds into the hero slot once Aren records it.
- Optional future (needs Aren's money approval): custom domain ~$12/yr, Botpress paid, SMS via Twilio.
