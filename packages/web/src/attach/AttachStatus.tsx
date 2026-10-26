import { Text } from "@astryxdesign/core/Text";
import { StatusText } from "../fields/StatusText.tsx";
import type { AttachStatus as Status } from "./useAttach.ts";

/**
 * The last upload's status under its field: "Adding <name>…", "Added <name>", or the refusal,
 * which stays until the next image. Screen readers hear it from `useAttach`'s announcement.
 */
export function AttachStatus({ status }: { status?: Status }) {
  if (!status) {
    return null;
  }
  return status.error ? (
    <StatusText tone="error" type="supporting">
      {status.text}
    </StatusText>
  ) : (
    <Text color="secondary" type="supporting">
      {status.text}
    </Text>
  );
}
