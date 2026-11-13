// The banner over the frame while the server is gone: it says the server stopped, what the app does
// about it, and the way out. This machine's server is started again by the host; another machine's
// is tried again by the store, every few seconds, and "Try now" tries at once.
import { View } from "nsh";
import type { Server } from "./host";
import { Banner, Button } from "../../ui/controls";
import { Surface } from "../../ui/surfaces";

export function Stopped(props: {
  /** Why this machine's server did not start again. */
  failed?: string;
  local: boolean;
  onRetry: () => void;
  /** The host is starting this machine's server again. */
  recovering: boolean;
  server: Server;
}) {
  const words = () => {
    if (props.failed !== undefined) return props.failed;
    if (props.local) {
      return props.recovering
        ? "Starting it again. What the app shows is as it was when it stopped."
        : "Starting it again failed. What the app shows is as it was when it stopped.";
    }
    return `${props.server.address} does not answer. The app tries again every few seconds; what it shows is as it was.`;
  };
  return (
    <View
      style={{ bottom: 52, left: 0, paddingHorizontal: 16, position: "absolute", right: 0 }}
      testID="server-stopped"
    >
      <Surface height="raised" style={{ alignSelf: "center", maxWidth: 640, width: "100%" }}>
        <Banner
          action={
            <If when={!props.recovering}>
              <Button
                icon="refresh-cw"
                label={props.local ? "Start it" : "Try now"}
                onPress={props.onRetry}
              />
            </If>
          }
          icon="server"
          title="Uraeda's server stopped"
          tone={props.failed === undefined ? "caution" : "danger"}
        >
          {words()}
        </Banner>
      </Surface>
    </View>
  );
}
