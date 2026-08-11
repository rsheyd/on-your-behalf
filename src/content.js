(function initializeOpenFormFiller() {
  if (globalThis.__openFormFillerLoaded) return;
  globalThis.__openFormFillerLoaded = true;

  const FIELD_ATTRIBUTE = "data-open-form-filler-id";
  const HIGHLIGHT_CLASS = "open-form-filler-filled";
  const STYLE_ID = "open-form-filler-style";
  let counter = 0;

  function text(value, maxLength = 500) {
    const normalized = String(value || "").replace(/\s+/g, " ").trim();
    return normalized.length > maxLength ? `${normalized.slice(0, maxLength - 1)}…` : normalized;
  }

  function isVisible(element) {
    const style = getComputedStyle(element);
    const rect = element.getBoundingClientRect();
    return style.display !== "none" && style.visibility !== "hidden" && rect.width > 0 && rect.height > 0;
  }

  function nearbyLabel(element) {
    const ariaLabelledBy = element.getAttribute("aria-labelledby");
    const ariaText = ariaLabelledBy?.split(/\s+/).map(id => document.getElementById(id)?.textContent).filter(Boolean).join(" ");
    const explicit = element.id ? document.querySelector(`label[for="${CSS.escape(element.id)}"]`)?.textContent : "";
    const wrapping = element.closest("label")?.textContent;
    const legend = element.closest("fieldset")?.querySelector("legend")?.textContent;
    const parentText = element.parentElement?.textContent;
    return text(element.getAttribute("aria-label") || ariaText || explicit || wrapping || legend || parentText || element.placeholder || element.name, 300);
  }

  function describedText(element) {
    return text((element.getAttribute("aria-describedby") || "")
      .split(/\s+/)
      .map(id => document.getElementById(id)?.textContent)
      .filter(Boolean)
      .join(" "), 300);
  }

  function sensitive(element, label) {
    const autocomplete = (element.autocomplete || element.getAttribute("autocomplete") || "").toLowerCase().split(/\s+/).pop();
    const sensitiveAutocomplete = new Set([
      "cc-name", "cc-given-name", "cc-additional-name", "cc-family-name", "cc-number", "cc-exp",
      "cc-exp-month", "cc-exp-year", "cc-csc", "cc-type", "current-password", "new-password", "one-time-code"
    ]);
    if ((element.type || "").toLowerCase() === "password" || sensitiveAutocomplete.has(autocomplete)) return true;
    return /(?:password|passcode|passwd|credit\s*card|card\s*number|cardholder|security\s*code|cvv|cvc|verification\s*code|one[- ]?time\s*(?:code|password)|\botp\b)/i.test(
      [label, element.name, element.id, element.placeholder, autocomplete].filter(Boolean).join(" ")
    );
  }

  function ensureId(element) {
    if (!element.hasAttribute(FIELD_ATTRIBUTE)) {
      counter += 1;
      element.setAttribute(FIELD_ATTRIBUTE, `off-${Date.now().toString(36)}-${counter}`);
    }
    return element.getAttribute(FIELD_ATTRIBUTE);
  }

  function optionList(element) {
    if (element instanceof HTMLSelectElement) {
      return [...element.options].filter(option => !option.disabled).map(option => ({ value: option.value, label: text(option.textContent, 150) }));
    }
    const controls = element.getAttribute("aria-controls");
    const owned = element.getAttribute("aria-owns");
    const listbox = document.getElementById(controls || owned || "");
    if (!listbox) return [];
    return [...listbox.querySelectorAll('[role="option"]')].map(option => ({
      value: option.getAttribute("data-value") || option.getAttribute("value") || text(option.textContent, 150),
      label: text(option.textContent, 150)
    }));
  }

  function scan() {
    document.querySelectorAll(`[${FIELD_ATTRIBUTE}]`).forEach(element => element.removeAttribute(FIELD_ATTRIBUTE));
    counter = 0;
    const candidates = [...document.querySelectorAll('input, textarea, select, [role="combobox"]')];
    const seenRadioGroups = new Set();
    const fields = [];

    for (const element of candidates) {
      if (fields.length >= 150) break;
      if (!isVisible(element) || element.disabled || element.readOnly) continue;
      const type = (element.type || "").toLowerCase();
      if (["hidden", "submit", "reset", "button", "image", "file"].includes(type)) continue;
      const label = nearbyLabel(element);
      if (sensitive(element, label)) continue;

      if (type === "radio") {
        const groupName = element.name || label;
        if (seenRadioGroups.has(groupName)) continue;
        seenRadioGroups.add(groupName);
        const radios = [...document.querySelectorAll('input[type="radio"]')].filter(radio => (radio.name || nearbyLabel(radio)) === groupName && isVisible(radio) && !radio.disabled);
        const fieldId = ensureId(element);
        radios.forEach(radio => radio.setAttribute(FIELD_ATTRIBUTE, fieldId));
        fields.push({
          fieldId,
          kind: "radio",
          label,
          name: element.name || "",
          required: radios.some(radio => radio.required),
          options: radios.map(radio => ({ value: radio.value, label: nearbyLabel(radio) || radio.value }))
        });
        continue;
      }

      const kind = type === "checkbox" ? "checkbox"
        : element instanceof HTMLSelectElement ? "select"
        : element.getAttribute("role") === "combobox" ? "custom-select"
        : element instanceof HTMLTextAreaElement ? "textarea"
        : "input";
      fields.push({
        fieldId: ensureId(element),
        kind,
        inputType: type || "text",
        label,
        name: element.name || "",
        placeholder: text(element.placeholder, 200),
        formatHint: text([
          element.getAttribute("title"),
          element.getAttribute("pattern"),
          describedText(element)
        ].filter(Boolean).join(" · "), 400),
        min: element.getAttribute("min") || "",
        max: element.getAttribute("max") || "",
        required: Boolean(element.required || element.getAttribute("aria-required") === "true"),
        options: optionList(element)
      });
    }

    return {
      page: {
        title: text(document.title, 200),
        url: `${location.origin}${location.pathname}`,
        heading: text(document.querySelector("h1")?.textContent, 200)
      },
      fields
    };
  }

  function dispatch(element) {
    element.dispatchEvent(new Event("input", { bubbles: true }));
    element.dispatchEvent(new Event("change", { bubbles: true }));
    element.dispatchEvent(new Event("blur", { bubbles: true }));
  }

  function setNativeValue(element, value) {
    const prototype = element instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(prototype, "value")?.set;
    if (setter) setter.call(element, String(value));
    else element.value = String(value);
    dispatch(element);
  }

  function highlight(element) {
    ensureStyle();
    element.classList.add(HIGHLIGHT_CLASS);
  }

  function ensureStyle() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `.${HIGHLIGHT_CLASS}{outline:2px solid #18a56b !important;outline-offset:2px !important;transition:outline-color .2s ease}`;
    document.documentElement.append(style);
  }

  async function fillCustomSelect(element, value) {
    element.focus();
    element.click();
    await new Promise(resolve => setTimeout(resolve, 120));
    const target = String(value).trim().toLowerCase();
    const options = [...document.querySelectorAll('[role="option"]')].filter(isVisible);
    const option = options.find(item => {
      const itemValue = item.getAttribute("data-value") || item.getAttribute("value") || "";
      return itemValue.toLowerCase() === target || text(item.textContent).toLowerCase() === target;
    });
    if (!option) return false;
    option.click();
    highlight(element);
    return true;
  }

  async function fill(suggestions) {
    let filled = 0;
    const failed = [];
    for (const suggestion of suggestions) {
      const elements = [...document.querySelectorAll(`[${FIELD_ATTRIBUTE}="${CSS.escape(suggestion.fieldId)}"]`)];
      const element = elements[0];
      if (!element || sensitive(element, nearbyLabel(element))) continue;
      try {
        const type = (element.type || "").toLowerCase();
        if (type === "radio") {
          const target = String(suggestion.value).toLowerCase();
          const radio = elements.find(item => item.value.toLowerCase() === target || nearbyLabel(item).toLowerCase() === target);
          if (!radio) throw new Error("No matching radio option");
          radio.click();
          dispatch(radio);
          highlight(radio);
        } else if (type === "checkbox") {
          const checked = suggestion.value === true || String(suggestion.value).toLowerCase() === "true";
          if (element.checked !== checked) element.click();
          dispatch(element);
          highlight(element);
        } else if (element instanceof HTMLSelectElement) {
          const target = String(suggestion.value).toLowerCase();
          const option = [...element.options].find(item => item.value.toLowerCase() === target || text(item.textContent).toLowerCase() === target);
          if (!option) throw new Error("No matching select option");
          element.value = option.value;
          dispatch(element);
          highlight(element);
        } else if (element.getAttribute("role") === "combobox") {
          if (!await fillCustomSelect(element, suggestion.value)) throw new Error("No matching custom option");
        } else {
          setNativeValue(element, suggestion.value);
          highlight(element);
        }
        filled += 1;
      } catch (error) {
        failed.push(suggestion.fieldId);
        console.warn("Open Form Filler could not fill a field", suggestion.fieldId, error);
      }
    }
    return { filled, failed };
  }

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.type === "SCAN_FORM") {
      sendResponse({ ok: true, ...scan() });
      return false;
    }
    if (message?.type === "FILL_FORM") {
      fill(message.suggestions || []).then(result => sendResponse({ ok: true, ...result }));
      return true;
    }
    return false;
  });
})();
