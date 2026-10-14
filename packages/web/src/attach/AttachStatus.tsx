import { Text } from "@astryxdesign/core/Text";
import { colorVars } from "@astryxdesign/core/theme/tokens.stylex";
import * as stylex from "@stylexjs/stylex";
import type { AttachStatus as Status } from "./useAttach.ts";

const styles = stylex.create({ error: { color: colorVars["--color-error"] } });

/**
 * The last upload's status under its field: "Adding <name>…", "Added <name>", or the refusal,
 * which stays until the next image. Screen readers hear it from `useAttach`'s announcement.
 */
export function AttachStatus({ status }: { status?: Status }) {
  if (!status) {
    return null;
  }
  return status.error ? (
    <Text type="supporting" xstyle={styles.error}>
      {status.text}
    </Text>
  ) : (
    <Text type="supporting" color="secondary">
      {status.text}
    </Text>
  );
}
