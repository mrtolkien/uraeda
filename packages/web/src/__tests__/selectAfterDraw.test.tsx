// The alt text inserted with an image is selected once the field shows the text holding it, even
// when the page draws again before that text reaches the field.
import { renderHook } from "@testing-library/react";
import { afterEach, expect, test } from "vite-plus/test";
import { useSelectAfterDraw } from "../attach/useImageText.ts";

const LINKED = "![shot](images/shot.webp)\n";

afterEach(() => {
  document.body.replaceChildren();
});

/** A field on the page, showing no text yet. */
function emptyField() {
  const field = document.createElement("textarea");
  document.body.append(field);
  return field;
}

test("a draw with the text before the links keeps the selection for the text with them", () => {
  const field = emptyField();
  const { rerender, result } = renderHook(() => useSelectAfterDraw({ current: field }));
  result.current.current = { range: [2, 6], text: LINKED };

  // The page draws again, as for the upload's status, before the field takes the links.
  rerender();
  field.value = LINKED;
  rerender();

  expect(field.value.slice(field.selectionStart, field.selectionEnd)).toBe("shot");
  expect(document.activeElement).toBe(field);
  expect(result.current.current).toBeUndefined();
});

test("a field not drawn drops the selection", () => {
  const { rerender, result } = renderHook(() => useSelectAfterDraw({ current: null }));
  result.current.current = { range: [2, 6], text: LINKED };
  rerender();
  expect(result.current.current).toBeUndefined();
});
