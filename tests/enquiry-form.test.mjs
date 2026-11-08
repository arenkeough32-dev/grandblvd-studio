import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import {
  buildMailtoUri,
  buildMessage,
  buildSmsUri,
  normalizeOffer,
  normalizeSource,
  readInitialState,
  validateStartForm
} from "../assets/enquiry-form.js";

test("normalizes known and unknown offers", () => {
  assert.equal(normalizeOffer("homepage-preview"), "homepage-preview");
  assert.equal(normalizeOffer("HOMEPAGE-PREVIEW"), "homepage-preview");
  assert.equal(normalizeOffer("unknown"), "homepage-preview");
});

test("old missed-call-test links fall back to the homepage preview", () => {
  assert.equal(normalizeOffer("missed-call-test"), "homepage-preview");
  assert.deepEqual(readInitialState("?offer=missed-call-test&src=flyer", null), {
    offer: "homepage-preview",
    source: "flyer"
  });
});

test("accepts only the existing safe source-token shape", () => {
  assert.equal(normalizeSource("deck-1"), "deck-1");
  assert.equal(normalizeSource("Bad_Source"), "");
  assert.equal(normalizeSource("a".repeat(21)), "");
});

test("reads offer and source from the query string", () => {
  assert.deepEqual(readInitialState("?offer=homepage-preview&src=deck", null), {
    offer: "homepage-preview",
    source: "deck"
  });
});

test("requires a shop name and rejects overlong or control-character input", () => {
  const missing = validateStartForm({ offer: "homepage-preview", shopName: "  " });
  assert.equal(missing.ok, false);
  assert.equal(missing.errors.shopName, "Shop name is required.");

  const overlong = validateStartForm({ offer: "homepage-preview", shopName: "x".repeat(81) });
  assert.equal(overlong.ok, false);
  assert.match(overlong.errors.shopName, /80 characters/);

  const control = validateStartForm({ offer: "homepage-preview", shopName: "Bad\u0007Name" });
  assert.equal(control.ok, false);
  assert.match(control.errors.shopName, /control characters/);
});

test("builds a structured SMS body with name, detail and source", () => {
  const result = validateStartForm({
    offer: "homepage-preview",
    shopName: "Classic Styles Salon & Day Spa",
    contactName: "Tammy",
    detail: "Color correction, $120",
    source: "deck"
  });
  assert.equal(result.ok, true);
  assert.equal(
    buildMessage(result.values),
    "Hi Grand Blvd Studio! I'd like a Free homepage preview.\n" +
      "Shop: Classic Styles Salon & Day Spa\n" +
      "Name: Tammy\n" +
      "Detail: Color correction, $120\n" +
      "Source: deck"
  );
});

test("builds a structured homepage-preview SMS body", () => {
  const result = validateStartForm({
    offer: "homepage-preview",
    shopName: "City Tribe Salon",
    detail: "Lived-in blonde and bridal hair"
  });
  assert.equal(result.ok, true);
  assert.equal(
    buildMessage(result.values),
    "Hi Grand Blvd Studio! I'd like a Free homepage preview.\n" +
      "Shop: City Tribe Salon\n" +
      "Detail: Lived-in blonde and bridal hair"
  );
});

test("encodes SMS and mailto handoff URIs", () => {
  const values = validateStartForm({ offer: "homepage-preview", shopName: "A & B Salon" }).values;
  assert.equal(
    buildSmsUri(buildMessage(values)),
    "sms:+17273127758?&body=" + encodeURIComponent(buildMessage(values))
  );
  assert.match(buildMailtoUri(values), /^mailto:hello@grandblvdstudio\.com\?subject=/);
  assert.match(buildMailtoUri(values), /A%20%26%20B%20Salon/);
});

test("blocked storage cannot break initial state or leak details", () => {
  const blockedStorage = {
    getItem() {
      throw new Error("Storage is blocked");
    }
  };
  assert.deepEqual(readInitialState("?offer=homepage-preview", blockedStorage), {
    offer: "homepage-preview",
    source: ""
  });
  assert.deepEqual(readInitialState("", blockedStorage), {
    offer: "homepage-preview",
    source: ""
  });
});

test("session storage is used only as a fallback when no src parameter exists", () => {
  const storage = { getItem: (key) => (key === "gbs-src" ? "Deck-9" : null) };
  assert.deepEqual(readInitialState("", storage), { offer: "homepage-preview", source: "deck-9" });
  assert.deepEqual(readInitialState("?src=flyer", storage), { offer: "homepage-preview", source: "flyer" });
});

test("start page markup keeps entered details out of the URL in every fallback path", () => {
  const here = dirname(fileURLToPath(import.meta.url));
  const html = readFileSync(join(here, "..", "start", "index.html"), "utf8");
  const css = readFileSync(join(here, "..", "assets", "start.css"), "utf8");
  const formTag = html.match(/<form[^>]*>/)[0];
  assert.match(formTag, /data-start-form/);
  assert.doesNotMatch(formTag, /\saction=/i);
  assert.match(html, /data-nojs-notice/);
  assert.match(css, /html:not\(\.js\)\s+\.start-card form\{display:none\}/);
  assert.match(html, /start-form-guard/);
  assert.match(html, /form\.dataset\.startReady === "true"/);
});

test("empty optional fields are omitted from the message", () => {
  const values = validateStartForm({ offer: "homepage-preview", shopName: "Zone Barber Shop" }).values;
  assert.equal(
    buildMessage(values),
    "Hi Grand Blvd Studio! I'd like a Free homepage preview.\nShop: Zone Barber Shop"
  );
});
