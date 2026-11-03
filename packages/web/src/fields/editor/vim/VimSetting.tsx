// The Vim mode switch as the shell reads it: the settings record, kept up to date, so turning it on
// or off in the settings page, or in the file, reaches every field at once, without rebuilding one.
import { type ReactNode, Suspense, useEffect, useState } from "react";
import { useSettings } from "../../../data.ts";
import { Unread } from "../../../HandOver.tsx";
import { OnListClient } from "../../../RepositoryMenu.tsx";
import { registerEditorExtension } from "../slot.ts";
import { finePointer, loadVim, setVimErrors, setVimOn, type VimLayer } from "./load.ts";

const NONE: ReadonlyArray<string> = [];

/**
 * Loads the engine with the switch on and a fine pointer, and puts the layer in every field until
 * the switch goes off or the shell goes; runs the human's commands as it starts and as they change,
 * leaving the fields as they are.
 */
export function useVimLayer(on: boolean, commands: ReadonlyArray<string>) {
  const [layer, setLayer] = useState<VimLayer>();
  useEffect(() => {
    let gone = false;
    let unregister: (() => void) | undefined;
    void loadVim({ commands: [], on }, { fine: finePointer() }).then((loaded) => {
      if (!gone && loaded) {
        unregister = registerEditorExtension(loaded.extension);
        setLayer(loaded);
        setVimOn(true);
      }
    });
    return () => {
      gone = true;
      unregister?.();
      setLayer(undefined);
      setVimOn(false);
    };
  }, [on]);
  // The commands as one value, so a new list with the same lines runs nothing again.
  const lines = commands.join("\n");
  useEffect(() => {
    if (!layer) {
      return;
    }
    setVimErrors(layer.runCommands(lines === "" ? [] : lines.split("\n")));
    return () => setVimErrors(NONE);
  }, [layer, lines]);
}

function ReadVim(): ReactNode {
  // A file that cannot be read leaves Vim at its default: off.
  const keyboard = useSettings()?.keyboard;
  useVimLayer(keyboard?.vimMode.inForce ?? false, keyboard?.vimCommands.inForce ?? NONE);
  return null;
}

/**
 * Reads the Vim mode switch and the human's Vim commands, and keeps the Vim layer in every field
 * while it is on. It draws nothing, under a `Suspense` of its own, so the page does not wait for the
 * settings; a failed read leaves Vim off.
 */
export function VimSetting() {
  return (
    <Unread>
      <Suspense fallback={null}>
        <OnListClient>
          <ReadVim />
        </OnListClient>
      </Suspense>
    </Unread>
  );
}
