// The Updates category: this app's version, where the last look for a new one stands, and the way
// to look again, or to install what it found (`../shell/updates.tsx`). A browser's app and a
// development run have no version of their own: the row says how they update instead.
import { platform, View } from "nsh";
import { wordsOf } from "./categories";
import {
  busy,
  checkForUpdates,
  found,
  InstallButton,
  installUpdate,
  ownVersion,
  updates,
  UpdateStatus,
} from "../shell/updates";
import { FieldRow, FieldRows } from "../../ui/lists/FieldRow";
import { Button, Text } from "../../ui/controls";

/** How an app without a version of its own updates. */
const elsewhere = () =>
  platform.os === "web"
    ? "In a browser, Uraeda is the one its server holds: update the server, and this page loads the new version."
    : "A development run updates with its checkout: it has no release to look for.";

/** What Enter does on the row, as its button does. */
function act() {
  if (ownVersion() === null) return;
  if (found() !== undefined && updates().is !== "checking") void installUpdate();
  else void checkForUpdates();
}

export function Updates() {
  return (
    <FieldRows rows={() => [{ act, id: "app" }]}>
      <FieldRow
        {...wordsOf("updates", "This app")}
        control={
          <If when={ownVersion() !== null}>
            <If
              when={found()}
              else={
                <Button
                  disabled={busy()}
                  icon="refresh-cw"
                  label="Check now"
                  onPress={() => void checkForUpdates()}
                  testID="check-updates"
                />
              }
            >
              <InstallButton />
            </If>
          </If>
        }
        from={ownVersion() === null ? null : `Uraeda ${ownVersion()}`}
        icon="download"
        id="app"
        testID="updates-row"
        under={
          <View style={{ gap: 4, paddingTop: 6 }}>
            <If when={ownVersion() !== null} else={<Text tone="faint">{elsewhere()}</Text>}>
              <UpdateStatus />
            </If>
          </View>
        }
      />
    </FieldRows>
  );
}
