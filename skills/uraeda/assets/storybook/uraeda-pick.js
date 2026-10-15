// Lets Uraeda's embed of a story size its frame and comment on an element picked in it. Load it in
// every story's page, as a classic script, for any Storybook framework: from
// `.storybook/preview-head.html`, or the config's `previewHead`.
//
// To the embedding page, `window.parent`, it posts:
// - `{ uraeda: "ready" }` once loaded;
// - `{ uraeda: "size", height }` when the story's height changes;
// - `{ uraeda: "picked", role, name, text }` for the element clicked in pick mode;
// - `{ uraeda: "pick-stopped" }` when Escape ends pick mode.
// From it, it obeys `{ uraeda: "pick", on }`, and ignores every other window.
//
// Its names are kept in a block, out of the page's global scope.

{
  /** The story's window. */
  const page = globalThis;

  /** The roles whose accessible name is their text, when nothing else names them. */
  const NAMED_BY_CONTENT = new Set([
    "button",
    "cell",
    "checkbox",
    "columnheader",
    "heading",
    "link",
    "menuitem",
    "menuitemcheckbox",
    "menuitemradio",
    "option",
    "radio",
    "row",
    "rowheader",
    "switch",
    "tab",
    "tooltip",
    "treeitem",
  ]);

  /** The implicit roles of common elements, by tag name. */
  const ROLES = {
    A: "link",
    ARTICLE: "article",
    ASIDE: "complementary",
    BUTTON: "button",
    DIALOG: "dialog",
    FOOTER: "contentinfo",
    FORM: "form",
    H1: "heading",
    H2: "heading",
    H3: "heading",
    H4: "heading",
    H5: "heading",
    H6: "heading",
    HEADER: "banner",
    HR: "separator",
    IMG: "img",
    LI: "listitem",
    MAIN: "main",
    NAV: "navigation",
    OL: "list",
    OPTION: "option",
    P: "paragraph",
    PROGRESS: "progressbar",
    SUMMARY: "button",
    TABLE: "table",
    TD: "cell",
    TEXTAREA: "textbox",
    TH: "columnheader",
    TR: "row",
    UL: "list",
  };

  /** The implicit roles of `input` elements, by type; any other type is a text box. */
  const INPUT_ROLES = {
    button: "button",
    checkbox: "checkbox",
    image: "button",
    number: "spinbutton",
    radio: "radio",
    range: "slider",
    reset: "button",
    search: "searchbox",
    submit: "button",
  };

  /** The elements a click inside picks rather than the element clicked. */
  const CONTROLS = "[role], a[href], button, input, select, summary, textarea";

  /** The pointer events pick mode keeps from the story; a click picks. */
  const POINTER = [
    "pointerdown",
    "pointerup",
    "mousedown",
    "mouseup",
    "click",
    "dblclick",
    "auxclick",
  ];

  /** The white space of a text, collapsed. */
  const SPACES = /\s+/g;

  /** Whether pick mode is on. */
  let picking = false;
  /** The outline drawn over the element under the pointer, in pick mode. */
  let outline = null;
  /** The last height posted. */
  let height = -1;

  /** Posts a message to the embedding page. */
  const post = (message) => page.parent.postMessage(message, "*");

  /** The trimmed text of an element, its white space collapsed. */
  const textOf = (element) => (element?.textContent ?? "").replaceAll(SPACES, " ").trim();

  /** The element a pointer event picks: the control it is in, or its own target. */
  const targetOf = (event) =>
    typeof event.target?.closest === "function"
      ? (event.target.closest(CONTROLS) ?? event.target)
      : null;

  /** The element's role: its `role` attribute, else its implicit role, else `element`. */
  const roleOf = (element) => {
    const role = element.getAttribute("role")?.trim().split(SPACES)[0];
    if (role) {
      return role;
    }
    if (element.tagName === "INPUT") {
      return INPUT_ROLES[(element.getAttribute("type") ?? "").toLowerCase()] ?? "textbox";
    }
    if (element.tagName === "SELECT") {
      return element.multiple || element.size > 1 ? "listbox" : "combobox";
    }
    if (element.tagName === "A" && !element.hasAttribute("href")) {
      return "element";
    }
    return ROLES[element.tagName] ?? "element";
  };

  /**
   * The element's accessible name: its `aria-label`, the text of its `aria-labelledby`, its labels,
   * `alt`, or `title`, else its text for a role named by its content.
   */
  const nameOf = (element, role) => {
    const label = element.getAttribute("aria-label")?.trim();
    if (label) {
      return label;
    }
    const ids = element.getAttribute("aria-labelledby")?.trim();
    if (ids) {
      return ids
        .split(SPACES)
        .map((id) => textOf(page.document.getElementById(id)))
        .join(" ")
        .trim();
    }
    return (
      [...(element.labels ?? [])].map(textOf).join(" ").trim() ||
      element.getAttribute("alt")?.trim() ||
      element.getAttribute("title")?.trim() ||
      (NAMED_BY_CONTENT.has(role) ? textOf(element) : "")
    );
  };

  const sendSize = () => {
    const next = Math.ceil(page.document.body.getBoundingClientRect().height);
    if (next !== height) {
      height = next;
      post({ height, uraeda: "size" });
    }
  };

  /** Outlines the element under the pointer. */
  const draw = (event) => {
    const target = targetOf(event);
    if (!target) {
      return;
    }
    const box = target.getBoundingClientRect();
    if (!outline) {
      outline = page.document.createElement("div");
      outline.style.cssText =
        "position:fixed;pointer-events:none;z-index:2147483647;box-sizing:border-box;" +
        "border:2px solid #2563eb;border-radius:2px;background:rgb(37 99 235 / 0.12)";
      page.document.documentElement.append(outline);
    }
    Object.assign(outline.style, {
      height: `${box.height}px`,
      left: `${box.left}px`,
      top: `${box.top}px`,
      width: `${box.width}px`,
    });
  };

  /** Keeps a pointer event from the story; a click picks its element and ends pick mode. */
  const onPointer = (event) => {
    event.preventDefault();
    event.stopImmediatePropagation();
    const target = targetOf(event);
    if (event.type !== "click" || !target) {
      return;
    }
    const role = roleOf(target);
    stop();
    post({
      name: nameOf(target, role),
      role,
      text: textOf(target).slice(0, 200),
      uraeda: "picked",
    });
  };

  const onEscape = (event) => {
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopImmediatePropagation();
      stop();
      post({ uraeda: "pick-stopped" });
    }
  };

  const start = () => {
    if (picking) {
      return;
    }
    picking = true;
    page.addEventListener("pointermove", draw, true);
    page.addEventListener("keydown", onEscape, true);
    for (const type of POINTER) {
      page.addEventListener(type, onPointer, true);
    }
  };

  const stop = () => {
    picking = false;
    page.removeEventListener("pointermove", draw, true);
    page.removeEventListener("keydown", onEscape, true);
    for (const type of POINTER) {
      page.removeEventListener(type, onPointer, true);
    }
    outline?.remove();
    outline = null;
  };

  page.addEventListener("message", (event) => {
    const data = event.data;
    if (event.source !== page.parent || data?.uraeda !== "pick") {
      return;
    }
    if (data.on === true) {
      start();
    } else if (data.on === false) {
      stop();
    }
  });

  const ready = () => {
    post({ uraeda: "ready" });
    sendSize();
    new page.ResizeObserver(sendSize).observe(page.document.body);
  };

  if (page.document.readyState === "complete") {
    ready();
  } else {
    page.addEventListener("load", ready, { once: true });
  }
}
