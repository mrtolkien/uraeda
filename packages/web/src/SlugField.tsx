import { TextInput } from "@astryxdesign/core/TextInput";
import type { KeyboardEvent } from "react";
import { DISCARD_CHANGES, useConfirm } from "./fields/Confirm.tsx";
import { RestoreNotice } from "./fields/RestoreNotice.tsx";
import type { useTextField } from "./fields/useTextField.ts";

/** What the notice says when the slug the draft's name gives changed since one was typed. */
const SLUG_CHANGED = "The draft's name changed since.";

/**
 * A draft's slug, which Start names its folder and branch with: a field of the store, by the
 * draft's path, `<draft path>#slug`, over the slug the draft's name gives, kept as typed until the
 * feature starts. Escape on a changed slug asks "Discard your changes?" first.
 */
export function SlugField({ field }: { field: ReturnType<typeof useTextField> }) {
  const confirm = useConfirm();
  const cancel = async () => {
    if (field.dirty && (await confirm(DISCARD_CHANGES))) {
      field.discard();
    }
  };
  return (
    <>
      {field.restored && (
        <RestoreNotice changed={SLUG_CHANGED} onDiscard={field.discard} restored={field.restored} />
      )}
      <TextInput
        description="Two words at most: it names the folder and the branch."
        label="Slug"
        onChange={field.change}
        onKeyDown={(event: KeyboardEvent<HTMLInputElement>) => {
          if (event.key === "Escape" && field.dirty) {
            event.preventDefault();
            void cancel();
          }
        }}
        value={field.text}
      />
    </>
  );
}
