import { TextInput } from "@astryxdesign/core/TextInput";
import { RestoreNotice } from "./fields/RestoreNotice.tsx";
import type { useTextField } from "./fields/useTextField.ts";

/** What the notice says when the slug the draft's name gives changed since one was typed. */
const SLUG_CHANGED = "The draft's name changed since.";

/**
 * A draft's slug, which Start names its folder and branch with: a field of the store, by the
 * draft's path, `<draft path>#slug`, over the slug the draft's name gives, kept as typed until the
 * feature starts.
 */
export function SlugField({ field }: { field: ReturnType<typeof useTextField> }) {
  return (
    <>
      {field.restored && (
        <RestoreNotice changed={SLUG_CHANGED} onDiscard={field.discard} restored={field.restored} />
      )}
      <TextInput
        description="Two words at most: it names the folder and the branch."
        label="Slug"
        onChange={field.change}
        value={field.text}
      />
    </>
  );
}
