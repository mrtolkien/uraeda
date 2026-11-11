import { useBufferKey, withText } from "./buffer/useBufferKey.ts";
import { AnnouncedBanner } from "./layout/AnnouncedBanner.tsx";
import { Button } from "@astryxdesign/core/Button";
import { HStack } from "@astryxdesign/core/HStack";
import { Icon } from "@astryxdesign/core/Icon";
import { VStack } from "@astryxdesign/core/VStack";
import { useState } from "react";
import { useInbox } from "./data.ts";
import { useRuntimesAvailable } from "./runtimes.ts";
import { EditableLine } from "./EditableLine.tsx";
import { InboxList } from "./InboxList.tsx";
import { OrganizeButton, OrganizeMessage, TriageBanner } from "./InboxTriage.tsx";
import { useStartChat } from "./StartChat.tsx";
import { Page } from "./layout/Page.tsx";
import { useKeys } from "./keys/registry.tsx";
import { AddBar, AddNoteButton, useOpenAddForm } from "./SidebarAdd.tsx";
import { useCategoryActions } from "./lists/useCategoryActions.ts";
import { useRestoreScroll } from "./routes.tsx";
import { Empty } from "./layout/Empty.tsx";
import { PageTitle } from "./layout/PageTitle.tsx";

/**
 * The inbox: `INBOX.md`'s notes in a pane per category, the notes without one first, then in the
 * file's order, an empty category as an empty pane, under a line that says what the inbox is for.
 * Each note is edited in place, or opens its file, and drags to its place; the Git page commits
 * the inbox's changes with the priorities'. The heading carries the count and, on its right, the
 * page's actions as icons, in one row at every width: "Organize with AI", which asks for a triage,
 * one at a time, which its banner leads to, or dismisses for a new one; "New category", which
 * opens its field under the title and adds a pane; and ＋, which adds a note. `select` selects a note, as its address names it.
 */
export function InboxPage({ select }: { select?: { key: string } | undefined } = {}) {
  const inbox = useInbox();
  const agent = useRuntimesAvailable().available;
  const chat = useStartChat();
  const [message, setMessage] = useState<string>();
  const actions = useCategoryActions(inbox ?? { categories: [], hash: "", names: [] });
  const openForm = useOpenAddForm();
  // The ＋ next to Inbox, from the keyboard: the form in its default place. Not named in the status
  // line.
  useKeys([{ icon: "plus", keys: "a", label: "add", run: () => openForm("note") }]);
  useBufferKey(withText("specs/INBOX.md", inbox));
  // `C`, which the list declares with its other category keys, opens the New category line.
  const [newCategory, setNewCategory] = useState(0);
  // Its data is read before it draws: the position comes back at once.
  useRestoreScroll(true);
  if (!inbox) {
    return null;
  }
  return (
    <Page kind="rows">
      <VStack gap={2}>
        <PageTitle
          // One row at every width: the title, then its actions as icons.
          actions={
            <HStack align="center" gap={1}>
              {agent && <OrganizeButton chat={chat} triage={inbox.triage} />}
              <Button
                icon={<Icon icon="uraeda:folder-plus" />}
                isIconOnly
                label="New category"
                onClick={() => setNewCategory((count) => count + 1)}
                tooltip="New category"
                variant="ghost"
              />
              <AddNoteButton />
            </HStack>
          }
          count={inbox.count > 0 ? inbox.count : undefined}
        >
          Inbox
        </PageTitle>
        {!agent && inbox.triage === null && <OrganizeMessage />}
        {inbox.triage !== null && (
          <TriageBanner agent={agent} chat={chat} onRefused={setMessage} status={inbox.triage} />
        )}
        {chat.error && <AnnouncedBanner collapsible={false} status="error" title={chat.error} />}
        {message && <AnnouncedBanner collapsible={false} status="error" title={message} />}
        {inbox.count === 0 && (
          <Empty>The inbox is empty. Notes you add with ＋ next to Inbox land here.</Empty>
        )}
        {/* Drawn once the title's button, or `C`, opens it. */}
        <EditableLine
          empty="A category needs a name."
          field="inbox#new-category"
          isHiddenClosed
          label="New category"
          onSave={actions.add}
          opens={newCategory}
          value=""
        />
        <InboxList
          actions={actions}
          inbox={inbox}
          onNewCategory={() => setNewCategory((count) => count + 1)}
          onRefused={setMessage}
          select={select}
        />
      </VStack>
      <AddBar form="note" />
    </Page>
  );
}
