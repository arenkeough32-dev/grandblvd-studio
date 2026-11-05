import test from "node:test";
import assert from "node:assert/strict";
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
  assert.equal(normalizeOffer("MISSED-CALL-TEST"), "missed-call-test");
  assert.equal(normalizeOffer("unknown"), "missed-call-test");
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
  const missing = validateStartForm({ offer: "missed-call-test", shopName: "  " });
  assert.equal(missing.ok, false);
  assert.equal(missing.errors.shopName, "Shop name is required.");

  const overlong = validateStartForm({ offer: "missed-call-test", shopName: "x".repeat(81) });
  assert.equal(overlong.ok, false);
  assert.match(overlong.errors.shopName, /80 characters/);

  const control = validateStartForm({ offer: "missed-call-test", shopName: "Bad\u0007Name" });
  assert.equal(control.ok, false);
  assert.match(control.errors.shopName, /control characters/);
});

test("builds a structured missed-call-test SMS body", () => {
  const result = validateStartForm({
    offer: "missed-call-test",
    shopName: "Classic Styles Salon & Day Spa",
    contactName: "Tammy",
    detail: "Color correction, $120",
    source: "deck"
  });
  assert.equal(result.ok, true);
  assert.equal(
    buildMessage(result.values),
    "Hi Grand Blvd Studio! I'd like a Free Missed-Call Test.\n" +
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

test("empty optional fields are omitted from the message", () => {
  const values = validateStartForm({ offer: "missed-call-test", shopName: "Zone Barber Shop" }).values;
  assert.equal(
    buildMessage(values),
    "Hi Grand Blvd Studio! I'd like a Free Missed-Call Test.\nShop: Zone Barber Shop"
  );
});
