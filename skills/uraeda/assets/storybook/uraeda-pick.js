// Lets Uraeda's embed of a story size its frame and comment on an element picked in it. Load it in
// every story's page, as a classic script, for any Storybook framework: from
// `.storybook/preview-head.html`, or the config's `previewHead`.
//
// To the embedding page, `window.parent`, it posts:
// - `{ uraeda: "ready" }` once loaded;
// - `{ uraeda: "size", height }` when the story's height changes;
// - `{ uraeda: "picked", role, name, text, source, html }` for the element pressed or clicked in
//   pick mode, or focused when Enter or Space is pressed without a modifier: `text` is its text,
//   cut at 200 characters and then ending with "…", `source` the nearest `data-insp-path` of the
//   element or its parents, else `null`, and `html` its outer HTML, cut at 2000 characters;
// - `{ uraeda: "pick-stopped" }` when Escape ends pick mode.
// From it, it obeys `{ uraeda: "pick", on }`, and ignores every other window. Elements inside
// `[data-uraeda-pick-ignore]` are never outlined or picked, and their events reach them in pick
// mode, so a page's own controls for picking keep working.
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

  /** The roles of the controls a click inside picks rather than the element clicked. */
  const INTERACTIVE = [
    "button",
    "checkbox",
    "combobox",
    "link",
    "menuitem",
    "menuitemcheckbox",
    "menuitemradio",
    "option",
    "radio",
    "searchbox",
    "separator",
    "slider",
    "spinbutton",
    "switch",
    "tab",
    "textbox",
    "treeitem",
  ];

  /**
   * The controls a click inside picks rather than the element clicked: an element of an interactive
   * role, a native control, or a label, which stands for its control.
   */
  const CONTROLS = [
    ...INTERACTIVE.map((role) => `[role="${role}"]`),
    "a[href]",
    "button",
    "input",
    "label",
    "select",
    "summary",
    "textarea",
  ].join(", ");

  /** The native controls, which keep their role under `presentation` or `none`. */
  const NATIVE = "a[href], button, input, select, summary, textarea";

  /** The elements pick mode leaves to the page, and all inside them. */
  const IGNORED = "[data-uraeda-pick-ignore]";

  /** The keys that pick the focused element. */
  const KEYS = new Set(["Enter", " "]);

  /** The roles that say an element has none; never reported. */
  const NO_ROLE = new Set(["none", "presentation"]);

  /**
   * The pointer events pick mode keeps from the story, their default stopped; the end of a press
   * picks, as a disabled control gets no click, and so does a click without a press, from the
   * keyboard.
   */
  const POINTER = [
    "pointerdown",
    "pointerup",
    "mousedown",
    "mouseup",
    "click",
    "dblclick",
    "auxclick",
    "contextmenu",
  ];

  /**
   * The touch events pick mode keeps from the story, their default left alone, so a tap still
   * makes the click that picks.
   */
  const TOUCH = ["touchstart", "touchmove", "touchend"];

  /** How long the rest of a picking press is kept from the story, at most, in milliseconds. */
  const PRESS_MS = 1000;

  /**
   * How long the rest of a picking key press, its repeats and key up, is kept from the story, at
   * most, in milliseconds: a key held longer is the story's again.
   */
  const KEY_MS = 5000;

  /** The most of an element's text, then "…", and of its outer HTML, a pick posts. */
  const TEXT_MAX = 200;
  const HTML_MAX = 2000;

  /** The white space of a text, collapsed. */
  const SPACES = /\s+/g;

  /** Whether pick mode is on. */
  let picking = false;
  /** The outline drawn over the element under the pointer, in pick mode. */
  let outline = null;
  /** The last height posted. */
  let height = -1;
  /** End keeping the rest of a picking press, or key press, from the story, while it is kept. */
  let endPress = null;
  let endKey = null;

  /** Posts a message to the embedding page. */
  const post = (message) => page.parent.postMessage(message, "*");

  /** The trimmed text of an element, its white space collapsed. */
  const textOf = (element) => (element?.textContent ?? "").replaceAll(SPACES, " ").trim();

  /** Whether the element is left to the page in pick mode. */
  const ignored = (element) => element.closest(IGNORED) !== null;

  /**
   * The element a pointer event picks: the control it is in, a label's control, or its own target;
   * none inside an ignored element.
   */
  const targetOf = (event) => {
    if (typeof event.target?.closest !== "function" || ignored(event.target)) {
      return null;
    }
    const control = event.target.closest(CONTROLS);
    if (control?.tagName === "LABEL") {
      return control.control ?? control;
    }
    return control ?? event.target;
  };

  /**
   * The element's role: the first of its `role` attribute's that is not `none` or `presentation`,
   * else its implicit role, else `element`. A native control keeps its implicit role under `none`.
   */
  const roleOf = (element) => {
    const roles = (element.getAttribute("role") ?? "").trim().split(SPACES).filter(Boolean);
    const role = roles.find((value) => !NO_ROLE.has(value));
    if (role) {
      return role;
    }
    if (roles.length > 0 && !element.matches(NATIVE)) {
      return "element";
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
   * The element's accessible name, from the first source that gives one: its `aria-label`, the text
   * of its `aria-labelledby`, its labels, `alt`, `title`, a text box's `placeholder`, else its text
   * for a role named by its content.
   */
  const nameOf = (element, role) =>
    element.getAttribute("aria-label")?.trim() ||
    (element.getAttribute("aria-labelledby") ?? "")
      .split(SPACES)
      .map((id) => (id ? textOf(page.document.getElementById(id)) : ""))
      .join(" ")
      .trim() ||
    [...(element.labels ?? [])].map(textOf).join(" ").trim() ||
    element.getAttribute("alt")?.trim() ||
    element.getAttribute("title")?.trim() ||
    (role === "textbox" || role === "searchbox"
      ? element.getAttribute("placeholder")?.trim()
      : "") ||
    (NAMED_BY_CONTENT.has(role) ? textOf(element) : "");

  /** Storybook's root, holding the story, if the page has it. */
  const rootOf = () => page.document.querySelector("#storybook-root");

  /**
   * The story's height: Storybook's root and the body's margins and padding around it, since the
   * body of the centered layout is at least as tall as the window; else the body's.
   */
  const measure = () => {
    const body = page.document.body;
    const root = rootOf();
    if (!root) {
      return body.getBoundingClientRect().height;
    }
    const style = page.getComputedStyle(body);
    const around = [
      style.marginTop,
      style.marginBottom,
      style.paddingTop,
      style.paddingBottom,
    ].reduce((sum, value) => sum + (Number.parseFloat(value) || 0), 0);
    return root.getBoundingClientRect().height + around;
  };

  const sendSize = () => {
    const next = Math.ceil(measure());
    if (next !== height) {
      height = next;
      post({ height, uraeda: "size" });
    }
  };

  /** Outlines the element under the pointer, and none over an ignored element. */
  const draw = (event) => {
    const target = targetOf(event);
    if (!target) {
      outline?.remove();
      outline = null;
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

  /** Keeps a pointer or touch event from the story, stopping the default of a pointer event only. */
  const keep = (event) => {
    if (!TOUCH.includes(event.type)) {
      event.preventDefault();
    }
    event.stopImmediatePropagation();
  };

  /**
   * Keeps the rest of the press that picked from the story, its touch end, mouse events, and click,
   * until its click, a new press, or `PRESS_MS`: a press with no click, as on a disabled control,
   * leaves the next press to the story.
   */
  const keepPressRest = () => {
    const rest = (event) => {
      if (event.type === "pointerdown") {
        endPress();
        return;
      }
      keep(event);
      if (event.type === "click") {
        endPress();
      }
    };
    const timer = page.setTimeout(() => endPress?.(), PRESS_MS);
    for (const type of [...POINTER, ...TOUCH]) {
      page.addEventListener(type, rest, true);
    }
    endPress = () => {
      page.clearTimeout(timer);
      for (const type of [...POINTER, ...TOUCH]) {
        page.removeEventListener(type, rest, true);
      }
      endPress = null;
    };
  };

  /**
   * Keeps the rest of the key press that picked from the story, its repeats and its key up, which
   * would type a space or press a button, until that key up, the window's blur, as the key up then
   * comes elsewhere or never, pick mode's next start, or `KEY_MS`.
   */
  const keepKeyRest = (key) => {
    const rest = (event) => {
      if (event.key !== key) {
        return;
      }
      keep(event);
      if (event.type === "keyup") {
        endKey();
      }
    };
    const timer = page.setTimeout(() => endKey?.(), KEY_MS);
    page.addEventListener("keydown", rest, true);
    page.addEventListener("keyup", rest, true);
    const blur = () => endKey();
    page.addEventListener("blur", blur);
    endKey = () => {
      page.clearTimeout(timer);
      page.removeEventListener("keydown", rest, true);
      page.removeEventListener("keyup", rest, true);
      page.removeEventListener("blur", blur);
      endKey = null;
    };
  };

  /** Ends pick mode, and posts the element picked. */
  const pick = (target) => {
    const role = roleOf(target);
    const text = textOf(target);
    stop();
    post({
      html: target.outerHTML.slice(0, HTML_MAX),
      name: nameOf(target, role),
      role,
      source: target.closest("[data-insp-path]")?.getAttribute("data-insp-path") ?? null,
      text: text.length > TEXT_MAX ? `${text.slice(0, TEXT_MAX)}…` : text,
      uraeda: "picked",
    });
  };

  /**
   * Keeps a pointer or touch event from the story; a press outlines its element, as touch has no
   * hover, and its end, or a click without one, picks it and ends pick mode. An ignored element's
   * events reach it.
   */
  const onPointer = (event) => {
    if (typeof event.target?.closest === "function" && ignored(event.target)) {
      return;
    }
    keep(event);
    if (event.type === "pointerdown") {
      draw(event);
    }
    const target = targetOf(event);
    if ((event.type !== "pointerup" && event.type !== "click") || !target) {
      return;
    }
    pick(target);
    if (event.type === "pointerup") {
      keepPressRest();
    }
  };

  /**
   * Escape ends pick mode, and Enter or Space picks the focused element: the story gets neither key.
   * A key with a modifier, or one composing text, is the story's, and so is a key with nothing
   * focused, the body, or an ignored element.
   */
  const onKey = (event) => {
    if (event.key === "Escape") {
      keep(event);
      stop();
      post({ uraeda: "pick-stopped" });
      return;
    }
    const focused = page.document.activeElement;
    const modified = event.ctrlKey || event.metaKey || event.altKey || event.shiftKey;
    if (
      !KEYS.has(event.key) ||
      modified ||
      event.isComposing ||
      !focused ||
      focused === page.document.body ||
      focused === page.document.documentElement ||
      ignored(focused)
    ) {
      return;
    }
    keep(event);
    keepKeyRest(event.key);
    pick(focused);
  };

  const start = () => {
    if (picking) {
      return;
    }
    picking = true;
    endPress?.();
    endKey?.();
    page.addEventListener("pointermove", draw, true);
    page.addEventListener("keydown", onKey, true);
    for (const type of [...POINTER, ...TOUCH]) {
      page.addEventListener(type, onPointer, true);
    }
  };

  const stop = () => {
    picking = false;
    page.removeEventListener("pointermove", draw, true);
    page.removeEventListener("keydown", onKey, true);
    for (const type of [...POINTER, ...TOUCH]) {
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
    const observer = new page.ResizeObserver(sendSize);
    observer.observe(page.document.body);
    const root = rootOf();
    if (root) {
      observer.observe(root);
    }
  };

  if (page.document.readyState === "complete") {
    ready();
  } else {
    page.addEventListener("load", ready, { once: true });
  }
}
