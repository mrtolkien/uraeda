// Astryx's own text field from its root: refused by `no-restricted-imports`, which names the shared
// editor.
import { TextInput } from "@astryxdesign/core";

export function AstryxRootTextInput() {
  return <TextInput label="Title" />;
}
