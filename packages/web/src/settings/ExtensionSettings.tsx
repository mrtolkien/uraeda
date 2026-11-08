// The settings' Extensions section, as the spec's mockups draw it: a banner for each extension that
// needs the human, then "Your extensions" and "Built in", a row each: its icon, title, description,
// version, source, and where it is on; its switch and "Only in…"; under it, its settings, and the
// section its own page registers.
import { HStack } from "@astryxdesign/core/HStack";
import { Text } from "@astryxdesign/core/Text";
import { VStack } from "@astryxdesign/core/VStack";
import { type ReactNode, useState } from "react";
import { KeyCap } from "../keys/KeyCap.tsx";
import { AnnouncedBanner } from "../layout/AnnouncedBanner.tsx";
import { Pane } from "../layout/Pane.tsx";
import { ExtensionForm, type SetSetting } from "./ExtensionForm.tsx";
import { OnlyIn, type SetOn, WhereControls } from "./ExtensionWhere.tsx";
import {
  aboutLine,
  type ExtensionRow,
  extensionSetting,
  type KeyClash,
  listed,
  type Notice,
  noticesOf,
  type OnIn,
} from "./extensions.ts";
import { SettingRow, SettingRows, useRefusal } from "./SettingRow.tsx";

/** What the section reads: the `Extensions` record, the repositories' names, and the page's own. */
export type ExtensionsValues = {
  extensions: ReadonlyArray<ExtensionRow>;
  /** Your extensions folder, as messages show it. */
  folder: string;
  /**
   * The keys of an extension's page another took first, from the page's registry
   * (`useKeyClashes`). The record's own `keys` are shown too.
   */
  keyClashes?: (name: string) => ReadonlyArray<KeyClash>;
  /**
   * An extension's own settings section, which its page registers (`settingsSection`), drawn under
   * its row: task 12 wires it to task 9's `useContributions("settingsSection")`.
   */
  ownSection?: (name: string) => ReactNode;
  /** The repositories' names, the "Only in…" list's and the settings' scope picker's. */
  repositories: ReadonlyArray<string>;
};

/** What the section changes, each resolving with the refusal to show, or nothing once saved. */
export type ExtensionActions = { setOn: SetOn; setSetting: SetSetting };

/** A notice's text, its keys drawn as keys. */
function NoticeTitle({ notice }: { notice: Notice }) {
  return (
    <>
      {notice.parts.map((part) =>
        typeof part === "string" ? part : <KeyCap key={part.keys}>{part.keys}</KeyCap>,
      )}
    </>
  );
}

/** The banners of the extensions shown, in the section's order: what needs the human first. */
function Notices({ notices }: { notices: ReadonlyArray<Notice> }) {
  if (notices.length === 0) {
    return null;
  }
  return (
    <VStack gap={2}>
      {notices.map((notice) => (
        <AnnouncedBanner
          collapsible={false}
          key={notice.id}
          status={notice.status}
          title={<NoticeTitle notice={notice} />}
        />
      ))}
    </VStack>
  );
}

/** An extension's row: what it is, where it is on, and under it its settings and its section. */
function ExtensionItem({
  actions,
  row,
  values,
}: {
  actions: ExtensionActions;
  row: ExtensionRow;
  values: ExtensionsValues;
}) {
  const [isPicking, setPicking] = useState(false);
  const [refused, setRefused] = useRefusal(`extension:${row.name}:on`);
  const setOn = async (on: OnIn) => {
    setRefused(undefined);
    setRefused(await actions.setOn(row.name, on));
  };
  const own = values.ownSection?.(row.name);
  return (
    <SettingRow
      notes={
        <VStack gap={3}>
          <Text color="secondary" size="sm">
            {aboutLine(row)}
          </Text>
          {refused && <AnnouncedBanner collapsible={false} status="error" title={refused} />}
        </VStack>
      }
      setting={extensionSetting(row)}
      under={
        (isPicking || row.settings.length > 0 || own) && (
          <VStack gap={4}>
            {isPicking && (
              <OnlyIn repositories={values.repositories} row={row} setOn={(on) => void setOn(on)} />
            )}
            {row.settings.length > 0 && (
              <ExtensionForm
                repositories={values.repositories}
                row={row}
                setSetting={actions.setSetting}
              />
            )}
            {own}
          </VStack>
        )
      }
    >
      <WhereControls
        isPicking={isPicking}
        onPick={() => setPicking((open) => !open)}
        row={row}
        setOn={(on) => void setOn(on)}
      />
    </SettingRow>
  );
}

/** What "Your extensions" says while there is none. */
function NoneYet({ folder }: { folder: string }) {
  return (
    <HStack paddingBlock={3} paddingInline={3}>
      <Text color="secondary">
        None yet. Ask a session to write one, or add a folder to {folder} with ura extension add.
      </Text>
    </HStack>
  );
}

/**
 * The Extensions section's panes, those of its rows that `shows` keeps: the banners of the
 * extensions kept, then yours, then Uraeda's own. "Your extensions" shows while the search is
 * empty even with none, to say where they go.
 */
export function ExtensionSettings({
  actions,
  isSearching,
  shows,
  values,
}: {
  actions: ExtensionActions;
  isSearching: boolean;
  shows: (label: string) => boolean;
  values: ExtensionsValues;
}) {
  const rows = listed(values.extensions).filter((row) => shows(row.title));
  const yours = rows.filter((row) => !row.isBuiltIn);
  const builtIn = rows.filter((row) => row.isBuiltIn);
  const notices = rows.flatMap((row) => noticesOf(row, values.keyClashes?.(row.name)));
  const items = (list: ReadonlyArray<ExtensionRow>) => (
    <SettingRows>
      {list.map((row) => (
        <ExtensionItem actions={actions} key={row.name} row={row} values={values} />
      ))}
    </SettingRows>
  );
  return (
    <VStack gap={6}>
      <Notices notices={notices} />
      {(yours.length > 0 || !isSearching) && (
        <Pane icon="uraeda:plug" title="Your extensions">
          {yours.length > 0 ? items(yours) : <NoneYet folder={values.folder} />}
        </Pane>
      )}
      {builtIn.length > 0 && (
        <Pane icon="uraeda:layers" title="Built in">
          {items(builtIn)}
        </Pane>
      )}
    </VStack>
  );
}
