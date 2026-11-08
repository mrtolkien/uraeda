// Where an extension is on: its switch, on for every repository or off, and "Only in…", which
// opens the list of repositories under the row, one box each, saved as each is ticked.
import { Button } from "@astryxdesign/core/Button";
import { CheckboxList, CheckboxListItem } from "@astryxdesign/core/CheckboxList";
import { HStack } from "@astryxdesign/core/HStack";
import { Switch } from "@astryxdesign/core/Switch";
import type { ExtensionRow, OnIn } from "./extensions.ts";

/** Sends where an extension is on: the refusal to show, or nothing once saved. */
export type SetOn = (name: string, on: OnIn) => Promise<string | undefined>;

/**
 * The row's controls: its switch, on when it is on anywhere, turning it on for every repository or
 * off everywhere; and "Only in…", which shows or hides the repositories' list.
 */
export function WhereControls({
  isPicking,
  onPick,
  row,
  setOn,
}: {
  isPicking: boolean;
  onPick: () => void;
  row: ExtensionRow;
  setOn: (on: OnIn) => void;
}) {
  return (
    <HStack align="center" gap={3}>
      <Button
        aria-expanded={isPicking}
        label="Only in…"
        onClick={onPick}
        size="sm"
        variant="secondary"
      />
      <Switch
        isLabelHidden
        label={`${row.title} on`}
        onChange={(on: boolean) => setOn(on ? "all" : [])}
        value={row.onAll || row.on.length > 0}
      />
    </HStack>
  );
}

/**
 * The repositories an extension can be on in, ticked where it is: every one when it is on for
 * every repository. Ticking one saves the list ticked, which no longer follows a repository added
 * later. A name it is on in that left the list stays, so it can be unticked.
 */
export function OnlyIn({
  repositories,
  row,
  setOn,
}: {
  repositories: ReadonlyArray<string>;
  row: ExtensionRow;
  setOn: (on: OnIn) => void;
}) {
  const names = [...new Set([...repositories, ...row.on])];
  return (
    <CheckboxList
      label={`${row.title} is on in`}
      onChange={(ticked: Array<string>) => setOn(names.filter((name) => ticked.includes(name)))}
      value={row.onAll ? names : [...row.on]}
    >
      {names.map((name) => (
        <CheckboxListItem key={name} label={name} value={name} />
      ))}
    </CheckboxList>
  );
}
