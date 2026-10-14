// The repository menu, in the navigation's heading: the repositories, most recently opened first,
// the current one checked, a filter, each row's ⋯ menu with Remove, and "Add a repository…". A
// popover on wide screens, a bottom sheet on narrow ones. Its reads and the list's mutations go
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
import { RepositoriesView } from "./views.ts";

const styles = stylex.create({
  // The heading's trigger: "Uraeda" over the repository's name, two lines, the chevron at its end.
  trigger: {
    height: "auto",
    minHeight: sizeVars["--size-element-md"],
    justifyContent: "space-between",
    textAlign: "start",
  },
  names: {
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-start",
    minWidth: 0,
  },
  brand: {
    display: "block",
    fontSize: typeScaleVars["--text-large-size"],
    fontWeight: fontWeightVars["--font-weight-semibold"],
    lineHeight: typeScaleVars["--text-large-leading"],
  },
  // A row without the check keeps its name where the checked row's is.
  unchecked: {
    visibility: "hidden",
  },
});

/**
 * The global fate client, `/fate`, set by `App` around a repository's pages, whose own client is in
 * context there; outside them, the client in context is the global one.
 */
export const ListClientContext = createContext<Client | null>(null);

/** Its children on the global client, which reads and changes the list. */
function OnListClient({ children }: { children: ReactNode }) {
  const client = use(ListClientContext);
  return client ? <FateClient client={client}>{children}</FateClient> : children;
}

/** The repositories each global client has opened: once per repository and tab. */
const opened = new WeakMap<object, Set<string>>();

/**
 * Opens a repository the first time its page shows in the tab, which moves it first in the list,
 * through the client in context, the global one. Nothing for null.
 */
export function useOpenRepository(name: string | null) {
  const fate = useFateClient();
  useEffect(() => {
    if (name === null) {
      return;
    }
    let names = opened.get(fate);
    if (!names) {
      names = new Set();
      opened.set(fate, names);
    }
    if (names.has(name)) {
      return;
    }
    names.add(name);
    void fate.mutations.repositories.open({ input: { name }, view: RepositoriesView });
  }, [fate, name]);
}

/** The menu's content: the filter, the list's problem, the rows, a refusal, and Add. */
function Menu({
  current,
  onPick,
  onAdd,
  onRemovedCurrent,
}: {
  current: string | null;
  onPick: (name: string) => void;
  onAdd: () => void;
  onRemovedCurrent: () => void;
}) {
  const fate = useFateClient();
  const list = useRepositories();
  const wide = useWidthClass() === "wide";
  const [filter, setFilter] = useState("");
  const [refused, setRefused] = useState<string>();
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
        label="Filter repositories"
        isLabelHidden
        placeholder="Filter repositories"
        startIcon="search"
        value={filter}
        onChange={(value: string) => setFilter(value)}
      />
      {list?.problem && <Banner status="error" title={list.problem} collapsible={false} />}
      <List aria-label="Repositories" density="compact">
        {rows.map((row) => (
          <ListItem
            key={row.name}
            label={row.name}
            description={
              row.missing ? (
                <Text type="supporting" color="error" display="block">
                  Folder not found: {row.home}
                </Text>
              ) : (
                row.home
              )
            }
            isSelected={row.name === current}
            startContent={
              row.name === current ? (
                <Icon icon="check" label="Current" />
              ) : (
                <Icon icon="check" xstyle={styles.unchecked} />
              )
            }
            endContent={
              <MoreMenu
                label={`More for ${row.name}`}
                alignment="end"
                presentation={wide ? "popover" : "bottom-sheet"}
                items={[{ label: "Remove from Uraeda", onClick: () => void remove(row.name) }]}
              />
            }
            onClick={(event: React.MouseEvent) => {
              // A click in the row's ⋯ menu, drawn elsewhere in the page, reaches the row through
              // React's tree: only the row's own pick it.
              if (event.currentTarget.contains(event.target as Node)) {
                onPick(row.name);
              }
            }}
          />
        ))}
      </List>
      {refused && <Banner status="error" title={refused} collapsible={false} />}
      <List aria-label="Add" density="compact">
        <ListItem
          label="Add a repository…"
          startContent={<span aria-hidden="true">+</span>}
          onClick={onAdd}
        />
      </List>
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
  label,
  isOpen,
  onClose,
  children,
}: {
  label: string;
  isOpen: boolean;
  onClose: () => void;
  children: ReactNode;
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
    <Overlay label={label} isOpen={isOpen} onClose={onClose}>
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
        onPick={(name) => closeThen(() => navigate(repoPath(name, "/")))}
        onAdd={() => closeThen(() => setAdding(true))}
        onRemovedCurrent={() => closeThen(() => navigate("/"))}
      />
    </Suspense>
  );

  const trigger = isFolded ? (
    <Button
      variant="ghost"
      label={label}
      isIconOnly
      icon={<Icon icon="arrowsUpDown" />}
      onClick={wide ? undefined : () => setOpen(true)}
    />
  ) : (
    <Button
      variant="ghost"
      label={label}
      width="100%"
      endContent={<Icon icon="chevronDown" />}
      xstyle={styles.trigger}
      onClick={wide ? undefined : () => setOpen(true)}
    >
      <span {...stylex.props(styles.names)}>
        <span {...stylex.props(styles.brand)}>Uraeda</span>
        {/* Its accessible name, the label, is the text it shows, words apart. */}
        {current !== null && " "}
        {current !== null && (
          <Text type="supporting" color="secondary" display="block">
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
          label={MENU}
          isOpen={open}
          onOpenChange={setOpen}
          width="var(--size-menu)"
          padding={2}
          placement={isFolded ? "end" : "below"}
          content={open ? menu : null}
        >
          {trigger}
        </Popover>
      ) : (
        <>
          {trigger}
          <Drawn label={MENU} isOpen={open} onClose={() => setOpen(false)}>
            {menu}
          </Drawn>
        </>
      )}
      <Drawn label={FORM} isOpen={adding} onClose={() => setAdding(false)}>
        <AddRepository
          onCancel={() => setAdding(false)}
          onAdded={(name) => {
            setAdding(false);
            afterOverlayCloses(FORM, () => navigate(repoPath(name, "/")));
          }}
        />
      </Drawn>
    </>
  );
}
