// `/sessions`, the phone's Sessions tab: what the column holds that the tabs do not. The repository
// menu, the inbox's and the priorities' ＋, the search, then the shell's panes, Needs you, Sessions,
// In progress, and Done, and the 5 h window. On a wider screen, the same panes as the column's.
import { Heading } from "@astryxdesign/core/Heading";
import { HStack } from "@astryxdesign/core/HStack";
import { VStack } from "@astryxdesign/core/VStack";
import { Page } from "../layout/Page.tsx";
import { RepositoryMenu } from "../RepositoryMenu.tsx";
import { useRepository } from "../routes.tsx";
import { Allowance } from "../sidebar/Allowance.tsx";
import { SearchField, useSessionQuery } from "../sidebar/Search.tsx";
import { AddNoteButton, AddPriorityButton } from "../SidebarAdd.tsx";
import { ShellPanes } from "./ShellPanes.tsx";

export function SessionsPage() {
  const current = useRepository();
  const { query, setText, text } = useSessionQuery();
  return (
    <Page isTight>
      <VStack gap={3}>
        <RepositoryMenu current={current} hasLogo />
        <Heading level={1}>Sessions</Heading>
        <HStack gap={2} wrap="wrap">
          <AddNoteButton text="Note" />
          <AddPriorityButton text="Priorities" />
        </HStack>
        <SearchField onChange={setText} text={text} />
        <VStack gap={1}>
          <ShellPanes query={query} />
          <Allowance />
        </VStack>
      </VStack>
    </Page>
  );
}
