// The repository menu, in the navigation's heading: the repositories, most recently opened first,
// the current one checked, a filter, each row's ⋯ menu with Remove, "Add a repository…", then
// "Sign out" and "Sign out everywhere…". A popover on wide screens, a bottom sheet on narrow ones. Its reads and the list's mutations go
// through the global client, which the repository gate reads too.
import { Banner } from "@astryxdesign/core/Banner";
import { Button } from "@astryxdesign/core/Button";
import { Icon } from "@astryxdesign/core/Icon";
import { List, ListItem } from "@astryxdesign/core/List";
import { MoreMenu } from "@astryxdesign/core/MoreMenu";
import { Popover } from "@astryxdesign/core/Popover";
import { Spinner } from "@astryxdesign/core/Spinner";
import { Text } from "@astryxdesign/core/Text";
import { TextInput } from "@astryxdesign/core/TextInput";
import { VStack } from "@astryxdesign/core/VStack";
import { fontWeightVars, sizeVars, typeScaleVars } from "@astryxdesign/core/theme/tokens.stylex";
import * as stylex from "@stylexjs/stylex";
import { createContext, type ReactNode, Suspense, use, useEffect, useState } from "react";
import { FateClient, useFateClient } from "react-fate";
import { AddRepository } from "./AddRepository.tsx";
import type { FateClient as Client } from "./clients.ts";
import { useRepositories } from "./data.ts";
import { refusal } from "./errors.ts";
import { afterOverlayCloses, Overlay } from "./layout/Overlay.tsx";
import { useWidthClass } from "./layout/useWidthClass.ts";
import { navigate, repoPath } from "./routes.tsx";
import { SignOutList } from "./sign-in/SignOutList.tsx";
import { useSignOutEverywhere } from "./sign-in/useSignOut.ts";
import { RepositoriesView } from "./views.ts";

const styles = stylex.create({
  brand: {
    display: "block",
    fontSize: typeScaleVars["--text-large-size"],
    fontWeight: fontWeightVars["--font-weight-semibold"],
    lineHeight: typeScaleVars["--text-large-leading"],
  },
  names: {
    alignItems: "flex-start",
    display: "flex",
    flexDirection: "column",
    minWidth: 0,
  },
  path: {
    // A path wraps anywhere rather than be cut: the UI checks decision cuts no text.
    overflowWrap: "anywhere",
  },
  trigger: {
    // The heading's trigger: "Uraeda" over the repository's name, two lines, the chevron at its end.
    height: "auto",
    justifyContent: "space-between",
    minHeight: sizeVars["--size-element-md"],
    textAlign: "start",
  },
  unchecked: {
    // A row without the check keeps its name where the checked row's is.
    visibility: "hidden",
  },
});

/**
 * The global fate client, `/fate`, set by `App` around a repository's pages, whose own client is in
 * context there; outside them, the client in context is the global one.
 */
export const ListClientContext = createContext<Client | null>(null);

/** Its children on the global client, which reads and changes the list and the settings. */
export function OnListClient({ children }: { children: ReactNode }) {
  const client = use(ListClientContext);
  return client ? <FateClient client={client}>{children}</FateClient> : children;
}

/**
 * Opens a repository each time the tab switches to it, which moves it first in the list, through
 * the client in context, the global one: once per switch, not on each render. Nothing for null.
 */
export function useOpenRepository(name: string | null) {
  const fate = useFateClient();
  useEffect(() => {
    if (name !== null) {
      void fate.mutations.repositories.open({ input: { name }, view: RepositoriesView });
    }
  }, [fate, name]);
}

/** A repository in the list, as the menu shows it. */
type Row = NonNullable<ReturnType<typeof useRepositories>>["rows"][number];

/**
 * A repository's row: its name over its folder, or why its folder is not found, checked when it is
 * the current one, with its ⋯ menu's "Remove from Uraeda".
 */
function RepositoryRow({
  current,
  onPick,
  onRemove,
  row,
}: {
  current: string | null;
  onPick: (name: string) => void;
  onRemove: (name: string) => void;
  row: Row;
}) {
  const wide = useWidthClass() === "wide";
  return (
    <ListItem
      description={
        row.missing ? (
          <Text color="error" display="block" type="supporting" xstyle={styles.path}>
            Folder not found: {row.home}
          </Text>
        ) : (
          <Text color="secondary" display="block" type="supporting" xstyle={styles.path}>
            {row.home}
          </Text>
        )
      }
      endContent={
        <MoreMenu
          alignment="end"
          items={[{ label: "Remove from Uraeda", onClick: () => onRemove(row.name) }]}
          label={`More for ${row.name}`}
          presentation={wide ? "popover" : "bottom-sheet"}
        />
      }
      isSelected={row.name === current}
      label={row.name}
      onClick={(event: React.MouseEvent) => {
        // A click in the row's ⋯ menu, drawn elsewhere in the page, reaches the row through
        // React's tree: only the row's own pick it.
        if (event.currentTarget.contains(event.target as Node)) {
          onPick(row.name);
        }
      }}
      startContent={
        row.name === current ? (
          <Icon icon="check" label="Current" />
        ) : (
          <Icon icon="check" xstyle={styles.unchecked} />
        )
      }
    />
  );
}

/**
 * The menu's content: the filter, the list's problem, the rows, a refusal, Add, and the sign-out
 * items. `refusedFirst` is a refusal to show as it opens, as a failed "Sign out everywhere".
 */
function Menu({
  current,
  onAdd,
  onPick,
  onRemovedCurrent,
  onSignOutEverywhere,
  refusedFirst,
}: {
  current: string | null;
  onAdd: () => void;
  onPick: (name: string) => void;
  onRemovedCurrent: () => void;
  onSignOutEverywhere: () => void;
  refusedFirst?: string;
}) {
  const fate = useFateClient();
  const list = useRepositories();
  const [filter, setFilter] = useState("");
  const [refused, setRefused] = useState(refusedFirst);
  const needle = filter.trim().toLowerCase();
  const rows = (list?.rows ?? []).filter(
    (row) => row.name.toLowerCase().includes(needle) || row.home.toLowerCase().includes(needle),
  );

  const remove = async (name: string) => {
    setRefused(undefined);
    const { error } = await fate.mutations.repositories.remove({
      input: { name },
      view: RepositoriesView,
    });
    if (error) {
      setRefused(refusal(error).message);
      return;
    }
    if (name === current) {
      onRemovedCurrent();
    }
  };

  return (
    <VStack gap={2}>
      <TextInput
        isLabelHidden
        label="Filter repositories"
        onChange={(value: string) => setFilter(value)}
        placeholder="Filter repositories"
        startIcon="search"
        value={filter}
      />
      {list?.problem && <Banner collapsible={false} status="error" title={list.problem} />}
      <List aria-label="Repositories" density="compact">
        {rows.map((row) => (
          <RepositoryRow
            current={current}
            key={row.name}
            onPick={onPick}
            onRemove={(name) => void remove(name)}
            row={row}
          />
        ))}
      </List>
      {refused && <Banner collapsible={false} status="error" title={refused} />}
      <List aria-label="Add" density="compact">
        <ListItem
          label="Add a repository…"
          onClick={onAdd}
          startContent={<span aria-hidden="true">+</span>}
        />
      </List>
      <SignOutList onRefused={setRefused} onSignOutEverywhere={onSignOutEverywhere} />
    </VStack>
  );
}

/**
 * The navigation's heading as the menu's trigger: "Uraeda" over the current repository's name, or
 * alone on a page of none, with a chevron; folded, an icon. It opens the menu, and the menu the add
 * form.
 */
export function RepositoryMenu({
  current,
  isFolded = false,
}: {
  current: string | null;
  isFolded?: boolean;
}) {
  return (
    <OnListClient>
      <MenuTrigger current={current} isFolded={isFolded} />
    </OnListClient>
  );
}

/**
 * An overlay drawn from its opening until its history entry is gone, as `Overlay` gives it: a
 * closed one, in the heading of every page, leaves nothing on the page.
 */
function Drawn({
  children,
  isOpen,
  label,
  onClose,
}: {
  children: ReactNode;
  isOpen: boolean;
  label: string;
  onClose: () => void;
}) {
  const [drawn, setDrawn] = useState(isOpen);
  if (isOpen && !drawn) {
    setDrawn(true);
  }
  useEffect(() => {
    if (!isOpen && drawn) {
      afterOverlayCloses(label, () => setDrawn(false));
    }
  }, [isOpen, drawn, label]);
  return drawn ? (
    <Overlay isOpen={isOpen} label={label} onClose={onClose}>
      {children}
    </Overlay>
  ) : null;
}

const MENU = "Repositories";
const FORM = "Add a repository";

function MenuTrigger({ current, isFolded }: { current: string | null; isFolded: boolean }) {
  const wide = useWidthClass() === "wide";
  const [open, setOpen] = useState(false);
  const [adding, setAdding] = useState(false);
  // A failed "Sign out everywhere" opens the menu again, saying why.
  const everywhere = useSignOutEverywhere(() => setOpen(true));
  const label = current === null ? "Uraeda" : `Uraeda ${current}`;

  /** Closes the menu, then runs what follows once its sheet's history entry is gone. */
  const closeThen = (run: () => void) => {
    setOpen(false);
    if (wide) {
      run();
    } else {
      afterOverlayCloses(MENU, run);
    }
  };
  const menu = (
    <Suspense fallback={<Spinner label="Loading the repositories" />}>
      <Menu
        current={current}
        onAdd={() => closeThen(() => setAdding(true))}
        onPick={(name) => closeThen(() => navigate(repoPath(name, "/")))}
        onRemovedCurrent={() => closeThen(() => navigate("/"))}
        onSignOutEverywhere={() => closeThen(everywhere.ask)}
        refusedFirst={everywhere.failed}
      />
    </Suspense>
  );

  const trigger = isFolded ? (
    <Button
      icon={<Icon icon="arrowsUpDown" />}
      isIconOnly
      label={label}
      onClick={wide ? undefined : () => setOpen(true)}
      variant="ghost"
    />
  ) : (
    <Button
      endContent={<Icon icon="chevronDown" />}
      label={label}
      onClick={wide ? undefined : () => setOpen(true)}
      variant="ghost"
      width="100%"
      xstyle={styles.trigger}
    >
      <span {...stylex.props(styles.names)}>
        <span {...stylex.props(styles.brand)}>Uraeda</span>
        {/* Its accessible name, the label, is the text it shows, words apart. */}
        {current !== null && " "}
        {current !== null && (
          <Text color="secondary" display="block" type="supporting">
            {current}
          </Text>
        )}
      </span>
    </Button>
  );

  return (
    <>
      {wide ? (
        <Popover
          content={open ? menu : null}
          isOpen={open}
          label={MENU}
          onOpenChange={setOpen}
          padding={2}
          placement={isFolded ? "end" : "below"}
          width="var(--size-menu)"
        >
          {trigger}
        </Popover>
      ) : (
        <>
          {trigger}
          <Drawn isOpen={open} label={MENU} onClose={() => setOpen(false)}>
            {menu}
          </Drawn>
        </>
      )}
      <Drawn isOpen={adding} label={FORM} onClose={() => setAdding(false)}>
        <AddRepository
          onAdded={(name) => {
            setAdding(false);
            afterOverlayCloses(FORM, () => navigate(repoPath(name, "/")));
          }}
          onCancel={() => setAdding(false)}
        />
      </Drawn>
    </>
  );
}
