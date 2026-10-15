import { Badge } from "@astryxdesign/core/Badge";
import { Heading } from "@astryxdesign/core/Heading";
import { HStack } from "@astryxdesign/core/HStack";
import { List, ListItem } from "@astryxdesign/core/List";
import { Text } from "@astryxdesign/core/Text";
import { VStack } from "@astryxdesign/core/VStack";
import type { InboxNote } from "uraeda-binding";
import { CommitBar } from "./CommitBar.tsx";
import { useInbox } from "./data.ts";
import { Page } from "./layout/Page.tsx";
import { Paragraph } from "./layout/Paragraph.tsx";
import { useLocalPath, useRepoPath, useRestoreScroll } from "./routes.tsx";
import { Spans } from "./Spans.tsx";

/** "1 note", "10 notes". */
export function notes(count: number) {
  return `${count} ${count === 1 ? "note" : "notes"}`;
}

/** A note's marks, as tags before its text: `agent` in a colour of its own, then its feature's. */
export function Marks({ note }: { note: InboxNote }) {
  if (!note.agent && !note.about) {
    return null;
  }
  return (
    <>
      {note.agent && <Badge label="agent" variant="purple" />}
      {note.about && <Badge label={note.about} variant="neutral" />}{" "}
    </>
  );
}

/** A note: its marks, then its text; tapped, it opens its view. */
function Note({ isSelected, note }: { isSelected: boolean; note: InboxNote }) {
  const here = useRepoPath();
  return (
    <ListItem
      href={here(`/inbox/${note.key}`)}
      isSelected={isSelected}
      // Nodes, not strings, so long notes wrap instead of being cut.
      label={
        <HStack align="center" gap={1} wrap="wrap">
          <Marks note={note} />
          <span>
            <Spans spans={note.spans} />
          </span>
        </HStack>
      }
    />
  );
}

/**
 * The inbox: `INBOX.md`'s notes under their categories, the notes without one first, then in the
 * file's order; a category with no note is hidden. Each note opens its view; the commit bar commits
 * the inbox's changes with the priorities'.
 */
export function InboxPage() {
  const inbox = useInbox();
  // The note open beside the list, on wide screens.
  const pathname = useLocalPath();
  // Its data is read before it draws: the position comes back at once.
  useRestoreScroll(true);
  if (!inbox) {
    return null;
  }
  return (
    <Page>
      <VStack gap={4}>
        <HStack align="baseline" gap={3} wrap="wrap">
          <Heading level={1}>Inbox</Heading>
          {inbox.count > 0 && <Text color="secondary">{notes(inbox.count)}</Text>}
        </HStack>
        {inbox.count === 0 && (
          <Paragraph color="secondary">
            The inbox is empty. Notes you add with ＋ next to Inbox land here.
          </Paragraph>
        )}
        {inbox.categories
          .filter((category) => category.notes.length > 0)
          .map((category) => {
            const name = category.name ?? "No category";
            return (
              <List
                aria-label={name}
                hasDividers
                header={<Heading level={2}>{name}</Heading>}
                key={category.name === undefined ? "none" : `category:${name}`}
              >
                {category.notes.map((note) => (
                  <Note isSelected={pathname === `/inbox/${note.key}`} key={note.id} note={note} />
                ))}
              </List>
            );
          })}
        <CommitBar changes={inbox.changes} />
      </VStack>
    </Page>
  );
}
