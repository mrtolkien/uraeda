// Astryx's own text field: refused by `no-restricted-imports`, which names the shared editor.
import { TextInput } from "@astryxdesign/core/TextInput";

export function AstryxTextInput() {
  return <TextInput label="Title" />;
}
