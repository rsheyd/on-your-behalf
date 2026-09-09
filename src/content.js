(function initializeOpenFormFiller() {
  const CONTENT_REVISION = "0.6.1-20260909.indexed-explanation-context";
  if (globalThis.__openFormFillerLoaded === CONTENT_REVISION) return;
  if (globalThis.__openFormFillerMessageListener) {
    chrome.runtime.onMessage.removeListener(globalThis.__openFormFillerMessageListener);
  }
  globalThis.__openFormFillerLoaded = CONTENT_REVISION;

  const FIELD_ATTRIBUTE = "data-open-form-filler-id";
  const ACTION_ATTRIBUTE = "data-open-form-filler-action-id";
  const HIGHLIGHT_CLASS = "open-form-filler-filled";
  const INFERRED_CLASS = "open-form-filler-inferred";
  const STYLE_ID = "open-form-filler-style";
  const MAX_SCANNED_FIELDS = 500;
  const formState = globalThis.OpenFormFillerState;
  const fieldLabels = globalThis.OpenFormFillerLabels;
  const logicalFieldIds = new Map();
  const logicalActionIds = new Map();
  let counter = 0;

  function text(value, maxLength = 500) {
    const normalized = String(value || "").replace(/\s+/g, " ").trim();
    return normalized.length > maxLength ? `${normalized.slice(0, maxLength - 1)}…` : normalized;
  }

  function isRendered(element) {
    if (!element) return false;
    const style = getComputedStyle(element);
    const rect = element.getBoundingClientRect();
    return style.display !== "none" && style.visibility !== "hidden" && rect.width > 0 && rect.height > 0;
  }

  function associatedLabel(element) {
    const explicit = element.id ? document.querySelector(`label[for="${CSS.escape(element.id)}"]`) : null;
    return explicit || element.closest("label");
  }

  function isVisible(element) {
    if (isRendered(element)) return true;
    const type = (element.type || "").toLowerCase();
    return ["checkbox", "radio"].includes(type) && isRendered(associatedLabel(element));
  }

  function isActionRendered(element) {
    return isRendered(element) || [...(element?.querySelectorAll("*") || [])].some(isRendered);
  }

  function directLabelCandidates(element) {
    const ariaLabelledBy = element.getAttribute("aria-labelledby");
    const ariaText = ariaLabelledBy?.split(/\s+/).map(id => {
      const labelledBy = document.getElementById(id);
      return labelledBy?.innerText || labelledBy?.textContent;
    }).filter(Boolean).join(" ");
    const explicitLabel = element.id ? document.querySelector(`label[for="${CSS.escape(element.id)}"]`) : null;
    const wrappingLabel = element.closest("label");
    const legendElement = element.closest("fieldset")?.querySelector("legend");
    const explicit = explicitLabel?.innerText || explicitLabel?.textContent;
    const wrapping = wrappingLabel?.innerText || wrappingLabel?.textContent;
    const legend = legendElement?.innerText || legendElement?.textContent;
    return [element.getAttribute("aria-label"), ariaText, explicit, wrapping, legend];
  }

  function optionLabel(element) {
    return text(directLabelCandidates(element).find(Boolean) || element.parentElement?.textContent || element.value, 150);
  }

  function contextualCandidates(element) {
    const candidates = [];
    let ancestor = element.parentElement;
    for (let depth = 0; ancestor && depth < 6 && ![document.body, document.documentElement].includes(ancestor); depth += 1, ancestor = ancestor.parentElement) {
      const clone = ancestor.cloneNode(true);
      clone.querySelectorAll("input, textarea, select, button, option, script, style, noscript, template, [role='option'], [hidden], [aria-hidden='true'], .hidden")
        .forEach(node => node.remove());
      candidates.push(clone.textContent);
    }
    return candidates;
  }

  function nearbyLabel(element, optionLabels = []) {
    return fieldLabels.chooseFieldLabel({
      primaryCandidates: directLabelCandidates(element),
      ancestorCandidates: contextualCandidates(element),
      optionLabels,
      fallback: element.placeholder || element.name,
      maxLength: 500
    });
  }

  function describedText(element) {
    return text((element.getAttribute("aria-describedby") || "")
      .split(/\s+/)
      .map(id => document.getElementById(id)?.textContent)
      .filter(Boolean)
      .join(" "), 300);
  }

  function instructionHint(element) {
    return fieldLabels.chooseInstructionHint(contextualCandidates(element), 400);
  }

  function sectionHeadings(scanRoot) {
    const selector = 'h1, h2, h3, h4, h5, h6, [role="heading"], [class*="sectionTitle" i], [class*="section-header" i], [class*="section_header" i]';
    const occurrences = new Map();
    return [...scanRoot.querySelectorAll(selector)].filter(isRendered).map(element => {
      const label = text(element.innerText || element.textContent, 120).replace(/^\*\s*/, "");
      if (!label) return null;
      const base = label.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "section";
      const occurrence = occurrences.get(base) || 0;
      occurrences.set(base, occurrence + 1);
      return { element, id: `${base}:${occurrence}`, label };
    }).filter(Boolean);
  }

  function sectionForElement(element, headings) {
    let match = null;
    for (const heading of headings) {
      if (heading.element === element || heading.element.contains(element) || (heading.element.compareDocumentPosition(element) & Node.DOCUMENT_POSITION_FOLLOWING)) match = heading;
      else if (match) break;
    }
    return match ? { sectionId: match.id, sectionLabel: match.label } : { sectionId: "", sectionLabel: "" };
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

  function ensureId(element, logicalKey) {
    const fieldId = formState.stableFieldId({
      logicalKey,
      currentId: element.getAttribute(FIELD_ATTRIBUTE) || "",
      identityMap: logicalFieldIds,
      createId() {
        counter += 1;
        return `off-${Date.now().toString(36)}-${counter}`;
      }
    });
    if (element.getAttribute(FIELD_ATTRIBUTE) !== fieldId) element.setAttribute(FIELD_ATTRIBUTE, fieldId);
    return fieldId;
  }

  function ensureActionId(element, logicalKey) {
    const currentId = element.getAttribute(ACTION_ATTRIBUTE) || "";
    const actionId = currentId || logicalActionIds.get(logicalKey) || `off-action-${Date.now().toString(36)}-${logicalActionIds.size + 1}`;
    logicalActionIds.set(logicalKey, actionId);
    if (currentId !== actionId) element.setAttribute(ACTION_ATTRIBUTE, actionId);
    return actionId;
  }

  function semanticHint(element, label) {
    return text(formState.semanticFieldHint({ domId: element.id, name: element.name, label }), 120);
  }

  function indexedEntry(element) {
    return formState.repeatedEntryOrdinal({ domId: element.id, name: element.name });
  }

  function structuralEntry(element, selector) {
    let container = element.parentElement;
    for (let depth = 0; container?.parentElement && depth < 4; depth += 1, container = container.parentElement) {
      const peers = [...container.parentElement.children].filter(peer => peer.querySelectorAll(selector).length >= 2);
      if (peers.length >= 2 && peers.includes(container)) return { parent: container.parentElement, ordinal: peers.indexOf(container) + 1 };
    }
    return null;
  }

  function currentValue(element, groupElements = [element]) {
    const type = (element.type || "").toLowerCase();
    if (type === "radio") return groupElements.find(item => item.checked)?.value || "";
    if (type === "checkbox") return Boolean(element.checked);
    const select = backingSelect(element);
    if (select) return select.value;
    return text(element.value || element.getAttribute("aria-valuetext") || "", 300);
  }

  function backingSelect(element) {
    if (element instanceof HTMLSelectElement) return element;
    return element.querySelector("select")
      || document.getElementById(`${element.id}_input`)
      || document.getElementById(`${element.id}-input`);
  }

  function placeholderOption(option) {
    const value = String(option?.value ?? "").trim().toLowerCase();
    const label = text(option?.textContent, 150).toLowerCase();
    return value === "" || /^(?:--\s*)?(?:select|choose)\b/.test(label) || ((value === "0" || value === "-1") && /select|choose/.test(label));
  }

  function selectIsEmpty(element) {
    if (!element || element.selectedIndex < 0) return true;
    return placeholderOption(element.options[element.selectedIndex]);
  }

  function elementIsEmpty(element, groupElements = [element]) {
    const type = (element.type || "").toLowerCase();
    if (type === "radio") return !groupElements.some(item => item.checked);
    if (type === "checkbox") return !element.checked;
    if (element instanceof HTMLSelectElement) return selectIsEmpty(element);
    if (element.getAttribute("role") === "combobox") {
      const select = backingSelect(element);
      if (select) return selectIsEmpty(select);
      const displayed = element.getAttribute("aria-valuetext") || element.querySelector(".ui-selectonemenu-label")?.textContent || element.textContent;
      return /^(?:--\s*)?(?:select|choose)\b/i.test(text(displayed, 150));
    }
    return !String(element.value || "").trim();
  }

  function optionList(element) {
    const select = backingSelect(element);
    if (select) {
      return [...select.options].filter(option => !option.disabled).map(option => ({ value: option.value, label: text(option.textContent, 150) }));
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
    const selector = 'input, textarea, select, [role="combobox"]';
    const main = document.querySelector("main");
    const scanRoot = main?.querySelector(selector) ? main : document;
    const candidates = [...scanRoot.querySelectorAll(selector)];
    const headings = sectionHeadings(scanRoot);
    const seenRadioGroups = new Set();
    const identityOccurrences = new Map();
    const repeatParents = new Map();
    const indexedEntryMaps = new Map();
    const fields = [];

    function repeatMetadata(element, label, section, groupElements = [element]) {
      const indexedOrdinal = indexedEntry(element);
      const structural = indexedOrdinal ? null : structuralEntry(element, selector);
      if (!indexedOrdinal && !structural) return {};
      let groupId;
      if (indexedOrdinal) {
        groupId = `${section.sectionId || "page"}:indexed-records`;
      } else {
        if (!repeatParents.has(structural.parent)) repeatParents.set(structural.parent, `${section.sectionId || "page"}:repeated:${repeatParents.size + 1}`);
        groupId = repeatParents.get(structural.parent);
      }
      return {
        groupId,
        groupLabel: section.sectionLabel || "Repeated entries",
        entryOrdinal: indexedOrdinal ? formState.visualEntryOrdinal(indexedOrdinal, groupId, indexedEntryMaps) : structural.ordinal,
        semanticHint: semanticHint(element, label),
        currentValue: currentValue(element, groupElements)
      };
    }

    for (const element of candidates) {
      if (fields.length >= MAX_SCANNED_FIELDS) break;
      if (!isVisible(element) || element.disabled || element.readOnly) continue;
      const type = (element.type || "").toLowerCase();
      if (["hidden", "submit", "reset", "button", "image", "file"].includes(type)) continue;

      if (type === "radio") {
        const groupName = element.name || nearbyLabel(element);
        if (seenRadioGroups.has(groupName)) continue;
        seenRadioGroups.add(groupName);
        const radios = [...scanRoot.querySelectorAll('input[type="radio"]')].filter(radio => (radio.name || nearbyLabel(radio)) === groupName && isVisible(radio) && !radio.disabled);
        const optionLabels = radios.map(optionLabel);
        const label = nearbyLabel(element, optionLabels);
        if (sensitive(element, label)) continue;
        const logicalKey = formState.logicalFieldKey({ domId: "", name: element.name || groupName, kind: "radio", label });
        const fieldId = ensureId(element, logicalKey);
        const section = sectionForElement(element, headings);
        radios.forEach(radio => radio.setAttribute(FIELD_ATTRIBUTE, fieldId));
        fields.push({
          fieldId,
          logicalKey,
          kind: "radio",
          label,
          name: element.name || "",
          required: radios.some(radio => radio.required),
          empty: elementIsEmpty(element, radios),
          currentValue: currentValue(element, radios),
          ...section,
          ...repeatMetadata(element, label, section, radios),
          options: radios.map((radio, index) => ({ value: radio.value, label: optionLabels[index] || radio.value }))
        });
        continue;
      }

      const nearby = nearbyLabel(element);
      const indexedOrdinal = indexedEntry(element);
      const semantic = indexedOrdinal ? semanticHint(element, nearby) : "";
      const label = indexedOrdinal ? fieldLabels.chooseIndexedFieldLabel({ nearbyLabel: nearby, semanticHint: semantic }) : nearby;
      if (sensitive(element, label)) continue;

      const kind = type === "checkbox" ? "checkbox"
        : element instanceof HTMLSelectElement ? "select"
        : element.getAttribute("role") === "combobox" ? "custom-select"
        : element instanceof HTMLTextAreaElement ? "textarea"
        : "input";
      const identity = { domId: element.id || "", name: element.name || "", kind, label };
      const identityBase = formState.logicalFieldKey(identity);
      const occurrence = identityOccurrences.get(identityBase) || 0;
      identityOccurrences.set(identityBase, occurrence + 1);
      const logicalKey = formState.logicalFieldKey(identity, occurrence);
      const section = sectionForElement(element, headings);
      fields.push({
        fieldId: ensureId(element, logicalKey),
        logicalKey,
        kind,
        inputType: type || "text",
        label,
        name: element.name || "",
        placeholder: text(element.placeholder, 200),
        formatHint: text([
          element.getAttribute("title"),
          element.getAttribute("pattern"),
          describedText(element),
          instructionHint(element)
        ].filter(Boolean).join(" · "), 400),
        min: element.getAttribute("min") || "",
        max: element.getAttribute("max") || "",
        required: Boolean(element.required || element.getAttribute("aria-required") === "true"),
        empty: elementIsEmpty(element),
        currentValue: currentValue(element),
        ...section,
        ...repeatMetadata(element, label, section),
        options: optionList(element)
      });
    }

    const validRepeatedGroups = formState.validRepeatedGroupIds(fields);
    for (const field of fields) {
      if (!field.groupId || validRepeatedGroups.has(field.groupId)) continue;
      delete field.groupId;
      delete field.groupLabel;
      delete field.entryOrdinal;
      delete field.semanticHint;
    }

    const actionCandidates = [...scanRoot.querySelectorAll('button, input[type="button"], a, [role="button"]')];
    const actions = [];
    for (const element of actionCandidates) {
      if (actions.length >= 20 || !isActionRendered(element) || element.disabled || element.getAttribute("aria-disabled") === "true") continue;
      const label = text(element.innerText || element.value || element.getAttribute("aria-label"), 120);
      if (!formState.isAddRepeatAction({ label, href: element.getAttribute("href") || "", anchor: element instanceof HTMLAnchorElement })) continue;
      const section = sectionForElement(element, headings);
      if (!fields.some(field => field.groupId && field.sectionId === section.sectionId)) continue;
      const logicalKey = `${section.sectionId || "page"}:${label.toLowerCase()}`;
      actions.push({
        actionId: ensureActionId(element, logicalKey),
        type: "add_repeat_entry",
        label,
        groupLabel: section.sectionLabel || label.replace(/^\s*\+?\s*add(?:\s+(?:another|new))?\s*/i, "") || "entry",
        ...section
      });
    }

    return {
      page: {
        title: text(document.title, 200),
        url: `${location.origin}${location.pathname}`,
        heading: text(document.querySelector("h1")?.textContent, 200)
      },
      fields,
      actions
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

  function highlight(element, basis = "supported") {
    ensureStyle();
    const target = isRendered(element) ? element : associatedLabel(element) || element;
    target.classList.add(HIGHLIGHT_CLASS);
    target.classList.toggle(INFERRED_CLASS, basis === "inferred");
  }

  function ensureStyle() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `.${HIGHLIGHT_CLASS}{outline:2px solid #18a56b !important;outline-offset:2px !important;transition:outline-color .2s ease}.${INFERRED_CLASS}{outline-color:#d88a16 !important}`;
    document.documentElement.append(style);
  }

  async function fillCustomSelect(element, value, basis) {
    element.focus();
    const opener = element.querySelector(".ui-selectonemenu-trigger") || element;
    opener.click();
    await new Promise(resolve => setTimeout(resolve, 220));
    const target = String(value).trim().toLowerCase();
    const visibleLabel = formState.customOptionDisplayLabel(value, optionList(element)).toLowerCase();
    const options = [...document.querySelectorAll('[role="option"]')].filter(isVisible);
    const option = options.find(item => {
      const itemValue = item.getAttribute("data-value") || item.getAttribute("value") || "";
      const itemLabel = text(item.textContent).toLowerCase();
      return itemValue.toLowerCase() === target || itemLabel === target || itemLabel === visibleLabel;
    });
    if (!option) return false;
    option.click();
    highlight(element, basis);
    return true;
  }

  function choiceControl(element) {
    const type = (element.type || "").toLowerCase();
    return type === "radio" || type === "checkbox" || element instanceof HTMLSelectElement || element.getAttribute("role") === "combobox";
  }

  function waitForPageSettled({ quietMs = 250, minMs = 500, maxMs = 3000 } = {}) {
    return new Promise(resolve => {
      const startedAt = performance.now();
      let quietTimer = null;
      let finished = false;
      let maxTimer = null;
      const finish = () => {
        if (finished) return;
        const remainingMinimum = minMs - (performance.now() - startedAt);
        if (remainingMinimum > 0) {
          clearTimeout(quietTimer);
          quietTimer = setTimeout(finish, remainingMinimum);
          return;
        }
        finished = true;
        clearTimeout(quietTimer);
        clearTimeout(maxTimer);
        observer.disconnect();
        resolve();
      };
      const scheduleQuiet = () => {
        clearTimeout(quietTimer);
        quietTimer = setTimeout(finish, quietMs);
      };
      const observer = new MutationObserver(scheduleQuiet);
      observer.observe(document.documentElement, {
        subtree: true,
        childList: true,
        attributes: true,
        attributeFilter: ["aria-hidden", "class", "disabled", "hidden", "style"]
      });
      maxTimer = setTimeout(finish, maxMs);
      scheduleQuiet();
    });
  }

  async function fill(suggestions, expectedFields = [], replaceExisting = false) {
    let filled = 0;
    let mutated = false;
    const filledIds = [];
    const failed = [];
    const skipped = [];
    let remainingSuggestions = [];
    const basisCounts = { supported: 0, inferred: 0, chosen: 0 };
    let latestScan = scan();
    const validSuggestions = formState.orderSuggestionsForFill(expectedFields.length
      ? formState.validSuggestionsForScan(suggestions, expectedFields, latestScan.fields)
      : suggestions, latestScan.fields);
    for (let suggestionIndex = 0; suggestionIndex < validSuggestions.length; suggestionIndex += 1) {
      const suggestion = validSuggestions[suggestionIndex];
      const elements = [...document.querySelectorAll(`[${FIELD_ATTRIBUTE}="${CSS.escape(suggestion.fieldId)}"]`)];
      const element = elements[0];
      if (!element || sensitive(element, nearbyLabel(element))) continue;
      if (!replaceExisting && !elementIsEmpty(element, elements)) {
        skipped.push(suggestion.fieldId);
        continue;
      }
      try {
        const beforeFields = latestScan.fields;
        const type = (element.type || "").toLowerCase();
        if (type === "radio") {
          const target = String(suggestion.value).toLowerCase();
          const radio = elements.find(item => item.value.toLowerCase() === target || nearbyLabel(item).toLowerCase() === target);
          if (!radio) throw new Error("No matching radio option");
          radio.click();
          dispatch(radio);
          highlight(radio, suggestion.basis);
        } else if (type === "checkbox") {
          const checked = suggestion.value === true || String(suggestion.value).toLowerCase() === "true";
          if (element.checked !== checked) element.click();
          highlight(element, suggestion.basis);
        } else if (element instanceof HTMLSelectElement) {
          const target = String(suggestion.value).toLowerCase();
          const option = [...element.options].find(item => item.value.toLowerCase() === target || text(item.textContent).toLowerCase() === target);
          if (!option) throw new Error("No matching select option");
          element.value = option.value;
          dispatch(element);
          highlight(element, suggestion.basis);
        } else if (element.getAttribute("role") === "combobox") {
          if (!await fillCustomSelect(element, suggestion.value, suggestion.basis)) throw new Error("No matching custom option");
        } else {
          setNativeValue(element, suggestion.value);
          highlight(element, suggestion.basis);
        }
        filled += 1;
        basisCounts[suggestion.basis] = (basisCounts[suggestion.basis] || 0) + 1;
        filledIds.push(suggestion.fieldId);
        if (choiceControl(element)) {
          const customSelectDelay = element.getAttribute("role") === "combobox";
          await waitForPageSettled({ minMs: customSelectDelay ? 1500 : 500 });
          latestScan = scan();
          const comparison = formState.compareFieldScans(beforeFields, latestScan.fields);
          mutated = comparison.newFields.length > 0 || comparison.changedFields.length > 0 || comparison.disappearedFields.length > 0;
          if (mutated) {
            remainingSuggestions = validSuggestions.slice(suggestionIndex + 1);
            break;
          }
        }
      } catch (error) {
        failed.push(suggestion.fieldId);
        console.warn("Open Form Filler could not fill a field", suggestion.fieldId, error);
      }
    }
    if (!mutated) latestScan = scan();
    return { filled, filledIds, failed, skipped, basisCounts, mutated, remainingSuggestions, scan: latestScan };
  }

  async function activateAction(action) {
    const beforeScan = scan();
    const allowed = beforeScan.actions.find(item => item.actionId === action?.actionId && item.type === "add_repeat_entry");
    if (!allowed) return { activated: false, scan: beforeScan };
    const element = document.querySelector(`[${ACTION_ATTRIBUTE}="${CSS.escape(allowed.actionId)}"]`);
    if (!element || !isActionRendered(element)) return { activated: false, scan: beforeScan };
    element.click();
    await waitForPageSettled({ minMs: 500 });
    const afterScan = scan();
    const comparison = formState.compareFieldScans(beforeScan.fields, afterScan.fields);
    const activated = comparison.newFields.length > 0 || comparison.changedFields.length > 0 || comparison.disappearedFields.length > 0;
    return { activated, scan: afterScan };
  }

  const messageListener = (message, _sender, sendResponse) => {
    if (message?.type === "SCAN_FORM") {
      sendResponse({ ok: true, ...scan() });
      return false;
    }
    if (message?.type === "FILL_FORM") {
      fill(message.suggestions || [], message.expectedFields || [], message.replaceExisting === true).then(result => sendResponse({ ok: true, ...result }));
      return true;
    }
    if (message?.type === "ACTIVATE_FORM_ACTION") {
      activateAction(message.action).then(result => sendResponse({ ok: true, ...result }));
      return true;
    }
    return false;
  };
  globalThis.__openFormFillerMessageListener = messageListener;
  chrome.runtime.onMessage.addListener(messageListener);
})();
