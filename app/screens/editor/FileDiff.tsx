// What changed between the file on disk and the text typed over an older version of it: the patch
// from the file to the text, which is what saving the text over the file would do. Rust writes the
// patch (`textPatch`), as git writes a file's diff, and `Diff` draws it.
import { computed } from "nsh";
import { textPatch } from "uraeda/native";
import { Diff } from "../../ui/document";
import { Empty } from "../../ui/lists";

export function FileDiff(props: { mine: string; on: string; path: string }) {
  const patch = computed(() => textPatch(props.path, props.on, props.mine));
  return (
    <If
      when={props.on !== props.mine}
      else={<Empty title="No difference" words="Your text is the file's text, as it is now." />}
    >
      <Diff keys patch={patch()} path={props.path} style={{ flex: 1 }} testID="buffer-diff" wrap />
    </If>
  );
}
