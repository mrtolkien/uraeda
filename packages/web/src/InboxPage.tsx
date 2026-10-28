import { Badge } from "@astryxdesign/core/Badge";
import { AnnouncedBanner } from "./layout/AnnouncedBanner.tsx";
import { Icon } from "@astryxdesign/core/Icon";
import { VStack } from "@astryxdesign/core/VStack";
import { useState } from "react";
import type { InboxNote } from "uraeda-binding";
import { useAgent, useInbox } from "./data.ts";
import { EditableLine } from "./EditableLine.tsx";
import { InboxList } from "./InboxList.tsx";
import { OrganizeButton, OrganizeMessage, TriageBanner } from "./InboxTriage.tsx";
import { useStartChat } from "./StartChat.tsx";
import { Page } from "./layout/Page.tsx";
import { useKeys } from "./keys/registry.tsx";
import { useOpenAddForm } from "./SidebarAdd.tsx";
import { useCategoryActions } from "./lists/useCategoryActions.ts";
import { useRestoreScroll } from "./routes.tsx";
import { Empty } from "./layout/Empty.tsx";
import { PageTitle } from "./layout/PageTitle.tsx";

/** A note's marks, as tags before its text: `agent` in a colour of its own, then its feature's. */
export function Marks({ note }: { note: InboxNote }) {
  if (!note.agent && !note.about) {
    return null;
  }
  return (
    <>
      {note.agent && <Badge label="agent" variant="purple" />}
      {note.agent && note.about && " "}
      {note.about && <Badge label={note.about} variant="neutral" />}{" "}
    </>
  );
}

/**
 * The inbox: `INBOX.md`'s notes in a pane per category, the notes without one first, then in the
 * file's order, an empty category as an empty pane, under a line that says what the inbox is for.
 * "New category" adds a pane. Each note is edited in place, or opens its draft, and drags to its
 * place; the commit bar commits the inbox's changes with the priorities'. The heading carries the
 * count, and "Organize with an agent", on its right, asks for a triage, one at a time, which its
 * banner leads to. `select` selects a note, as its address names it.
 */
export function InboxPage({ select }: { select?: { key: string } | undefined } = {}) {
  const inbox = useInbox();
  const agent = useAgent()?.available === true;
  const chat = useStartChat();
  const [message, setMessage] = useState<string>();
  const actions = useCategoryActions(inbox?.hash ?? "");
  const openForm = useOpenAddForm();
  // The ＋ next to Inbox, from the keyboard: the form in its default place. Not named in the status
  // line.
  useKeys([{ icon: "plus", keys: "a", label: "add", run: () => openForm("note") }]);
  // `C`, which the list declares with its other category keys, opens the New category line.
  const [newCategory, setNewCategory] = useState(0);
  // Its data is read before it draws: the position comes back at once.
  useRestoreScroll(true);
  if (!inbox) {
    return null;
  }
  return (
    <Page>
      <VStack gap={2}>
        <PageTitle
          aside={agent && <OrganizeButton chat={chat} triage={inbox.triage} />}
          count={inbox.count > 0 ? inbox.count : undefined}
        >
          Inbox
        </PageTitle>
        {!agent && inbox.triage === null && <OrganizeMessage />}
        {inbox.triage !== null && <TriageBanner agent={agent} chat={chat} status={inbox.triage} />}
        {chat.error && <AnnouncedBanner collapsible={false} status="error" title={chat.error} />}
        {message && <AnnouncedBanner collapsible={false} status="error" title={message} />}
        {inbox.count === 0 && (
          <Empty>The inbox is empty. Notes you add with ＋ next to Inbox land here.</Empty>
        )}
        <EditableLine
          display={
            <>
              <Icon icon="uraeda:plus" size="sm" /> New category
            </>
          }
          empty="A category needs a name."
          field="inbox#new-category"
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
    </Page>
  );
}
