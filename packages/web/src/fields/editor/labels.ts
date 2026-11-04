// A field's label: a click on it gives the field the focus, as a form field's label does.
import { EditorView } from "@codemirror/view";

/** Whether a click's label is a field's own, whose `for` names its content element. */
let labelsHeard = false;

/**
 * Gives a field the focus when its label is clicked, as a form field's label does: `for` names the
 * editor's content element, which is no form field the browser focuses. Once for the page.
 */
export function hearLabels(page: Document) {
  if (labelsHeard) {
    return;
  }
  labelsHeard = true;
  page.addEventListener("click", (event) => {
    const label = (event.target as Element | null)?.closest?.("label[for]");
    const content = label && page.getElementById((label as HTMLLabelElement).htmlFor);
    if (content?.classList.contains("cm-content")) {
      EditorView.findFromDOM(content)?.focus();
    }
  });
}
