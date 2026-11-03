import { RestoreNotice } from "./fields/RestoreNotice.tsx";
import { TextLine } from "./fields/TextLine.tsx";
import type { useTextField } from "./fields/useTextField.ts";

/** What the notice says when the slug the file's name gives changed since one was typed. */
const SLUG_CHANGED = "The proposal's name changed since.";

/** What the field says of the slug, unless the page words it shorter. */
const DESCRIPTION = "Two words at most: it names the folder and the branch.";

/**
 * A proposal file's slug, which Start names its folder and branch with: a field of the store, by
 * the file's path, `<file path>#slug`, over the slug the file's name gives, kept as typed until the
 * feature starts. Escape leaves the field, its text kept; the restored notice discards. `restoreNotice:
 * false` leaves out the editor's notice of a restored slug, for a page whose text comes back
 * as a new chat's does, like "New change". `description` words the help under it, `error` why the
 * slug started nothing, and `onEnter` runs on Enter.
 */
export function SlugField({
  description = DESCRIPTION,
  error,
  field,
  onEnter,
  restoreNotice = true,
}: {
  description?: string;
  error?: string;
  field: ReturnType<typeof useTextField>;
  onEnter?: () => void;
  restoreNotice?: boolean;
}) {
  return (
    <>
      {restoreNotice && field.restored && (
        <RestoreNotice changed={SLUG_CHANGED} onDiscard={field.discard} restored={field.restored} />
      )}
      {/* Escape leaves the field, its text kept: the page's keys work again. */}
      <TextLine
        description={description}
        label="Slug"
        onChange={field.change}
        value={field.text}
        {...(error === undefined ? {} : { status: { message: error, type: "error" as const } })}
        {...(onEnter ? { onEnter } : {})}
      />
    </>
  );
}
