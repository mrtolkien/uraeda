// The commit boxes of two groups, as the Git page's Changes shows them: one at a time, the group
// the cursor is in, which "Next group" changes, under the keys' host.
import { mount, signal, View } from "nsh";
import type { GitGroup } from "../../../store/protocol";
import { Button } from "../../../ui/controls";
import { KeysHost } from "../../../ui/keys/KeysHost";
import { CommitBoxes } from "../CommitBox";

const group = (id: string, name: string): GitGroup => ({
  defaultMessage: null,
  files: [
    {
      added: 1,
      id: `${id}:${name}.md`,
      path: `${name}.md`,
      removed: 0,
      staged: "yes",
      state: "modified",
    },
  ],
  folder: id === "." ? null : id,
  id,
  name,
});

const GROUPS = [group(".", "main"), group("specs/2026-11-01-dark-mode", "dark-mode")];

function Page() {
  const at = signal(0);
  return (
    <View style={{ flex: 1, gap: 8, padding: 16 }}>
      <Button label="Next group" onPress={() => at.set((at() + 1) % GROUPS.length)} />
      <CommitBoxes
        group={() => GROUPS[at()]}
        held={() => false}
        repo="checks"
        where={(shown) => `checks:${shown.id}`}
      />
    </View>
  );
}

mount(() => (
  <KeysHost>
    <Page />
  </KeysHost>
));
