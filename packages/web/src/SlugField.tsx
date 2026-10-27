import { TextInput } from "@astryxdesign/core/TextInput";
import type { KeyboardEvent } from "react";
import { RestoreNotice } from "./fields/RestoreNotice.tsx";
import type { useTextField } from "./fields/useTextField.ts";

/** What the notice says when the slug the draft's name gives changed since one was typed. */
const SLUG_CHANGED = "The draft's name changed since.";

/** What the field says of the slug, unless the page words it shorter. */
const DESCRIPTION = "Two words at most: it names the folder and the branch.";

/**
 * A draft's slug, which Start names its folder and branch with: a field of the store, by the
 * draft's path, `<draft path>#slug`, over the slug the draft's name gives, kept as typed until the
 * feature starts. Escape leaves the field, its text kept; the restored notice discards. `restoreNotice:
 * false` leaves out the draft editor's notice of a restored slug, for a page whose text comes back
 * as a new chat's does, like "New change". `description` words the help under it, and `onEnter`
 * runs on Enter.
 */
export function SlugField({
  description = DESCRIPTION,
  field,
  onEnter,
  restoreNotice = true,
}: {
  description?: string;
  field: ReturnType<typeof useTextField>;
  onEnter?: () => void;
  restoreNotice?: boolean;
}) {
  return (
    <>
      {restoreNotice && field.restored && (
        <RestoreNotice changed={SLUG_CHANGED} onDiscard={field.discard} restored={field.restored} />
      )}
      <TextInput
        description={description}
        label="Slug"
        onChange={field.change}
        onKeyDown={(event: KeyboardEvent<HTMLInputElement>) => {
          // Leaves the field, its text kept: the page's keys work again.
          if (event.key === "Escape") {
            event.preventDefault();
            event.currentTarget.blur();
          }
        }}
        value={field.text}
        {...(onEnter ? { onEnter } : {})}
      />
    </>
  );
}
