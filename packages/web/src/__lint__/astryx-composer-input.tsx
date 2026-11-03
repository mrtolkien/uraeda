// Astryx's composer field: refused by `no-restricted-imports`, which names the shared editor, while
// the composer around it stays allowed.
import { ChatComposer, ChatComposerInput } from "@astryxdesign/core/Chat";

export function AstryxComposerInput() {
  return (
    <ChatComposer onSubmit={() => {}}>
      <ChatComposerInput label="Message" />
    </ChatComposer>
  );
}
