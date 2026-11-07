# Call Flow Kit — Grand Blvd Studio

Pairs with the landing page (`site/index.html`) and VSL (`vsl-script.md`). The pre-call check-up SOP is the product: every call opens with a live, real disagreement found in minutes — never a fabricated one.

## 1. The 10-minute pre-call check-up SOP (before EVERY booked call)

1. Google the business name + town. Screenshot the knowledge panel (hours, phone, review count).
2. Open the top 4 other sources: Yelp, Bing Maps, Apple Maps, Facebook. Compare hours + phone + address line by line.
3. Find ONE disagreement (hours, phone, address, name spelling, missing Saturday). Two sources that disagree = the hook.
4. Check review velocity: last Google review date. If more than 30 days old, that's the second hook.
5. Write the one-line opener: "I checked [source A] and [source B] — they say two different things about [X]. Which is true?"
6. If NO disagreement is found: open with review velocity, or "how do new customers find you today?" — **never fake a gap.**

Time budget: 10 minutes. Output: one card per lead in the lead log (section 4).

## 2. SMS auto-reply templates — for the text line (727) 312-7758

> **Not wired to anything live yet.** These are the drafted message bodies; wiring them to an actual number/service is a separate step that needs its own explicit go-ahead before anything sends automatically.

Inbound text with a business name:
> "Got it — [Business Name], give me 10 minutes and I'll text back what the internet says about you. Free either way. — Aren, Grand Blvd Studio"

After the SOP is done:
> "Checked [Business]. Two things: [finding 1] and [finding 2]. Want the 10-minute call to walk through the fix list? — Aren"

If they ask price by text:
> "Depends on what's broken — most shops start with the $49/month care (first month free). But the check-up's free and I'll tell you honestly if you don't need anything. — Aren"

If no reply in 48h:
> "Last note from me — the list I made stays yours either way. If the hours thing bites you later, text me. — Aren"

## 3. Booking form — 4 fields only

Every extra field loses calls, so keep it to:

- Business name
- Town
- Phone
- "What's making you reach out?" (optional)

Intended behavior on submit: an instant text-back using template #1 above. **Not built yet** — the form itself doesn't exist as a live, submittable thing on `site/index.html` yet; it's a placeholder anchor. Building a real submit-to-SMS pipeline needs a decision on what service sends the text (and that's an external-service connection, which needs its own go-ahead).

## 4. Lead log — one line per call

Track every call with these columns:

| Business | Date/time | Reached owner? | Hook used | Reaction | Next step + date | Offer discussed ($249/$449/$649/$49/mo) | Follow-up due |
|---|---|---|---|---|---|---|---|

**Rule:** every call ends with a calendar next step or an explicit "close file" note — never "I'll call you sometime."

## 5. Objection quick-card

Lives in the Kimi-sourced refined pack (`kimi/`) — not duplicated here yet; pull it in once that file is confirmed current.
