// The repository menu's last group: "Sign out" and "Sign out everywhere…".
import { Icon } from "@astryxdesign/core/Icon";
import { List, ListItem } from "@astryxdesign/core/List";
import * as stylex from "@stylexjs/stylex";
import { useSignOut } from "./useSignOut.ts";

const styles = stylex.create({
  // An icon's room, empty: the items' names start where the repositories' do.
  room: { visibility: "hidden" },
});

/**
 * "Sign out", which signs this browser out at once, `onRefused` hearing why it could not, if so;
 * and "Sign out everywhere…", which asks first, through `onSignOutEverywhere`.
 */
export function SignOutList({
  onRefused,
  onSignOutEverywhere,
}: {
  onRefused: (message: string | undefined) => void;
  onSignOutEverywhere: () => void;
}) {
  const { signOut } = useSignOut();
  return (
    <List aria-label="Sign out" density="compact">
      <ListItem
        label="Sign out"
        onClick={async () => {
          onRefused(undefined);
          onRefused(await signOut());
        }}
        startContent={<Icon icon="check" xstyle={styles.room} />}
      />
      <ListItem
        label="Sign out everywhere…"
        onClick={onSignOutEverywhere}
        startContent={<Icon icon="check" xstyle={styles.room} />}
      />
    </List>
  );
}
