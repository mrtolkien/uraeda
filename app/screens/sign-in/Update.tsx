// The page shown when the server refused this app's version of the protocol: which side to update,
// this app or the server, and how. The app does nothing else: it reads no record and draws no frame,
// for neither side would understand the other.
import type { Refused } from "../../store";
import type { Server } from "../shell/host";
import { Lone } from "../shell/Lone";
import { Text } from "../../ui/controls";

export function Update(props: { refused: Refused; server: Server }) {
  const app = () => props.refused.update === "app";
  return (
    <Lone
      icon="refresh-cw"
      testID="update"
      title={app() ? "Update this app" : "Update the server"}
      tone="danger"
      words={
        app()
          ? `The server at ${props.server.address} is newer than this app: install this app's new release, then open it again.`
          : `This app is newer than the server at ${props.server.address}: update Uraeda on the server's machine, and start its server again. The app tries once it is back.`
      }
    >
      <Text size="under" tone="faint">
        Protocol {props.refused.protocol} on the server.
      </Text>
    </Lone>
  );
}
