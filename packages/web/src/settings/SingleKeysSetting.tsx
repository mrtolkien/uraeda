// The single-key shortcuts' switch as the shell reads it: the settings record, kept up to date, so
// a change in the settings page, or in the file, reaches the keys at once.
import { type ReactNode, Suspense, useEffect } from "react";
import { useSettings } from "../data.ts";
import { Unread } from "../HandOver.tsx";
import { OnListClient } from "../RepositoryMenu.tsx";

function ReadSingleKeys({ onRead }: { onRead: (on: boolean) => void }): ReactNode {
  // A file that cannot be read leaves the setting at its default: on.
  const on = useSettings()?.keyboard.singleKeyShortcuts.inForce ?? true;
  useEffect(() => onRead(on), [on, onRead]);
  return null;
}

/**
 * Reads whether the single-key shortcuts are on, and gives it to `onRead` at once and at each
 * change. It draws nothing, under a `Suspense` of its own, so the page does not wait for the
 * settings; a failed read gives nothing, and the shortcuts keep their last value (on at first).
 */
export function SingleKeysSetting({ onRead }: { onRead: (on: boolean) => void }) {
  return (
    <Unread>
      <Suspense fallback={null}>
        <OnListClient>
          <ReadSingleKeys onRead={onRead} />
        </OnListClient>
      </Suspense>
    </Unread>
  );
}
