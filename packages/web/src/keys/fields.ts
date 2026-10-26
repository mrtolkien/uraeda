// Who owns a key before the registry does: a text field owns every key as typed, and a few controls
// own Space. The one place of both rules: the listener and the leader's Space read them here.

/** Inputs that are no text: a button, a box to tick, a slider, a picker. They own no letter. */
const NOT_TEXT = [
  "button",
  "checkbox",
  "color",
  "file",
  "image",
  "radio",
  "range",
  "reset",
  "submit",
]
  .map((type) => `:not([type="${type}"])`)
  .join("");

/** A text field owns its keys, as typed: the registry never hears them. */
const TEXT_FIELD = `input${NOT_TEXT}, textarea, select, [contenteditable]:not([contenteditable="false"]), [role="textbox"]`;

/** Controls that Space is theirs on, besides a text field: it ticks, picks, or opens them. */
const OWN_SPACE =
  'input[type="checkbox"], input[type="radio"], [role="checkbox"], [role="radio"], [role="switch"], [role="combobox"]';

const closest = (target: EventTarget | null, selector: string) =>
  (target as Partial<Element> | null)?.closest?.(selector) != null;

/** Whether a key pressed on `target` is a text field's. */
export function inTextField(target: EventTarget | null) {
  return closest(target, TEXT_FIELD);
}

/** Whether Space pressed on `target` is its own: a text field, or a control Space ticks or picks. */
export function keepsSpace(target: EventTarget | null) {
  return inTextField(target) || closest(target, OWN_SPACE);
}
