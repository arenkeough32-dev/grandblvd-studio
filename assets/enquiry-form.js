const SMS_NUMBER = "+17273127758";

export const OFFERS = Object.freeze({
  "missed-call-test": Object.freeze({
    label: "Free Missed-Call Test",
    request: "Free Missed-Call Test",
    detailLabel: "Most common service and price (optional)",
    detailPlaceholder: "Example: Men’s cut, $25"
  }),
  "homepage-preview": Object.freeze({
    label: "Free homepage preview",
    request: "Free homepage preview",
    detailLabel: "What should the preview focus on? (optional)",
    detailPlaceholder: "Example: Bridal hair, color correction, walk-ins"
  })
});

const CONTROL_CHARS = /[\u0000-\u001F\u007F]/;
const MAX_SOURCE_LENGTH = 20;

export function normalizeOffer(value) {
  const offer = String(value || "").trim().toLowerCase();
  return Object.prototype.hasOwnProperty.call(OFFERS, offer) ? offer : "missed-call-test";
}

export function normalizeSource(value) {
  const source = String(value || "").trim().toLowerCase();
  return /^[a-z0-9-]{1,20}$/.test(source) ? source : "";
}

export function readInitialState(search, storage) {
  let source = "";
  try {
    const params = new URLSearchParams(search || "");
    source = normalizeSource(params.get("src"));
    if (!source && storage) source = normalizeSource(storage.getItem("gbs-src"));
    return {
      offer: normalizeOffer(params.get("offer")),
      source
    };
  } catch (error) {
    return { offer: "missed-call-test", source: "" };
  }
}

function cleanText(value, field, label, maxLength, errors, required = false) {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  if (!text) {
    if (required) errors[field] = `${label} is required.`;
    return "";
  }
  if (text.length > maxLength) {
    errors[field] = `${label} must be ${maxLength} characters or fewer.`;
    return "";
  }
  if (CONTROL_CHARS.test(text)) {
    errors[field] = `${label} cannot contain control characters.`;
    return "";
  }
  return text;
}

export function validateStartForm(input) {
  const errors = {};
  const offer = normalizeOffer(input && input.offer);
  const shopName = cleanText(input && input.shopName, "shopName", "Shop name", 80, errors, true);
  const contactName = cleanText(input && input.contactName, "contactName", "Your name", 60, errors, false);
  const detail = cleanText(input && input.detail, "detail", "Optional detail", 120, errors, false);
  const source = normalizeSource(input && input.source);

  return {
    ok: Object.keys(errors).length === 0,
    errors,
    values: Object.freeze({ offer, shopName, contactName, detail, source })
  };
}

export function buildMessage(values) {
  const offer = OFFERS[normalizeOffer(values.offer)];
  const lines = [
    `Hi Grand Blvd Studio! I'd like a ${offer.request}.`,
    `Shop: ${values.shopName}`
  ];
  if (values.contactName) lines.push(`Name: ${values.contactName}`);
  if (values.detail) lines.push(`Detail: ${values.detail}`);
  if (values.source) lines.push(`Source: ${values.source}`);
  return lines.join("\n");
}

export function buildSmsUri(message) {
  return `sms:${SMS_NUMBER}?&body=${encodeURIComponent(message)}`;
}

export function buildMailtoUri(values) {
  const offer = OFFERS[normalizeOffer(values.offer)];
  const subject = encodeURIComponent(offer.request);
  const body = encodeURIComponent(buildMessage(values));
  return `mailto:hello@grandblvdstudio.com?subject=${subject}&body=${body}`;
}

function setText(root, selector, text) {
  const el = root.querySelector(selector);
  if (el) el.textContent = text;
}

function showErrors(root, errors) {
  const summary = root.querySelector("[data-error-summary]");
  if (summary) {
    summary.hidden = Object.keys(errors).length === 0;
    summary.textContent = Object.keys(errors).length
      ? `Please fix ${Object.keys(errors).length} field${Object.keys(errors).length === 1 ? "" : "s"}: ${Object.values(errors).join(" ")}`
      : "";
  }
  ["shopName", "contactName", "detail"].forEach((name) => {
    const field = root.querySelector(`[data-field-error="${name}"]`);
    if (field) field.textContent = errors[name] || "";
  });
}

function selectedOffer(root) {
  const checked = root.querySelector('input[name="offer"]:checked');
  return normalizeOffer(checked && checked.value);
}

export function initStartForm(root, options) {
  const doc = root || document;
  const state = readInitialState((options && options.search) || window.location.search, (options && options.storage) || window.sessionStorage);
  const form = doc.querySelector("[data-start-form]");
  if (!form) return;

  const offerInputs = Array.from(form.querySelectorAll('input[name="offer"]'));
  const detailLabel = form.querySelector("[data-detail-label]");
  const detailInput = form.elements.detail;
  const syncOffer = (offerKey) => {
    const offer = OFFERS[offerKey];
    if (detailLabel) detailLabel.textContent = offer.detailLabel;
    if (detailInput) detailInput.placeholder = offer.detailPlaceholder;
  };
  offerInputs.forEach((input) => {
    input.checked = input.value === state.offer;
    input.addEventListener("change", () => syncOffer(selectedOffer(form)));
  });
  syncOffer(state.offer);

  const sourceInput = form.querySelector('input[name="source"]');
  if (sourceInput) sourceInput.value = state.source;

  const sourceNote = doc.querySelector("[data-source-note]");
  if (sourceNote) {
    sourceNote.hidden = !state.source;
    if (state.source) sourceNote.textContent = `Source tag: ${state.source}`;
  }

  let lastMessage = "";
  let lastOpenedAt = 0;

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const result = validateStartForm({
      offer: selectedOffer(form),
      shopName: form.elements.shopName.value,
      contactName: form.elements.contactName.value,
      detail: form.elements.detail.value,
      source: form.elements.source.value
    });
    showErrors(form, result.errors);
    if (!result.ok) {
      const first = Object.keys(result.errors)[0];
      const field = form.querySelector(`[name="${first}"]`);
      if (field) field.focus();
      return;
    }

    const message = buildMessage(result.values);
    const now = Date.now();
    setText(form, "[data-status]", "Opening your SMS app with the message filled in. Nothing has been sent yet.");
    if (message === lastMessage && now - lastOpenedAt < 5000) {
      setText(form, "[data-status]", "Your SMS app should already have this message. Nothing has been sent by this page.");
      return;
    }
    lastMessage = message;
    lastOpenedAt = now;
    window.location.href = buildSmsUri(message);
  });

  const copyButton = doc.querySelector("[data-copy-message]");
  const copyStatus = doc.querySelector("[data-copy-status]");
  if (copyButton) {
    copyButton.addEventListener("click", async () => {
      const result = validateStartForm({
        offer: selectedOffer(form),
        shopName: form.elements.shopName.value,
        contactName: form.elements.contactName.value,
        detail: form.elements.detail.value,
        source: form.elements.source.value
      });
      showErrors(form, result.errors);
      if (!result.ok) return;
      const message = buildMessage(result.values);
      try {
        if (!navigator.clipboard || !window.isSecureContext) throw new Error("Clipboard unavailable");
        await navigator.clipboard.writeText(message);
        if (copyStatus) copyStatus.textContent = "Message copied. Paste it into a text to (727) 312-7758.";
      } catch (error) {
        const helper = doc.querySelector("[data-message-preview]");
        if (helper) {
          helper.hidden = false;
          helper.value = message;
          helper.focus();
          helper.select();
        }
        if (copyStatus) copyStatus.textContent = "Clipboard is unavailable, so the message is selected below.";
      }
    });
  }
}

if (typeof document !== "undefined") {
  initStartForm(document);
}
