// The repository menu, in the navigation's heading: the repositories, most recently opened first,
// the current one checked, a filter, each row's ⋯ menu with Remove, and "Add a repository…".
// Signing out is in the settings' Sign-in category. A popover on wide screens, a bottom sheet on
// narrow ones. Its reads and the list's mutations go through the global client, which the
// repository gate reads too.
import { AnnouncedBanner } from "./layout/AnnouncedBanner.tsx";
import { Button } from "@astryxdesign/core/Button";
import { Icon } from "@astryxdesign/core/Icon";
import { List, ListItem } from "@astryxdesign/core/List";
import { Spinner } from "@astryxdesign/core/Spinner";
import { Text } from "@astryxdesign/core/Text";
import { TextInput } from "@astryxdesign/core/TextInput";
import { VStack } from "@astryxdesign/core/VStack";
import {
  colorVars,
  fontWeightVars,
  sizeVars,
  spacingVars,
  typeScaleVars,
} from "@astryxdesign/core/theme/tokens.stylex";
import * as stylex from "@stylexjs/stylex";
import {
  createContext,
  type ReactNode,
  Suspense,
  use,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { FateClient, useFateClient } from "react-fate";
import { AddRepository } from "./AddRepository.tsx";
import type { FateClient as Client } from "./clients.ts";
import { useRepositories } from "./data.ts";
import { refusal } from "./errors.ts";
import { afterOverlayCloses, Overlay } from "./layout/Overlay.tsx";
import { isNarrow, useWidthClass } from "./layout/useWidthClass.ts";
import { Logo } from "./Logo.tsx";
import { navigate, repoPath } from "./routes.tsx";
import { RepositoriesView } from "./views.ts";
import { ActionsMenu } from "./layout/ActionsMenu.tsx";
import { StatusText } from "./fields/StatusText.tsx";

const styles = stylex.create({
  // The row the arrows are on: the mauve tint of a list's selected row, with its bar at the start.
  cursor: {
    backgroundColor: colorVars["--color-accent-muted"],
    boxShadow: `inset 2px 0 0 0 ${colorVars["--color-accent"]}`,
  },
  brand: {
    display: "block",
    fontSize: typeScaleVars["--text-large-size"],
    fontWeight: fontWeightVars["--font-weight-semibold"],
    lineHeight: typeScaleVars["--text-large-leading"],
  },
  names: {
    alignItems: "baseline",
    columnGap: spacingVars["--spacing-2"],
    display: "flex",
    flexWrap: "wrap",
    minWidth: 0,
  },
  path: {
    // A path wraps anywhere rather than be cut: the UI checks decision cuts no text.
    overflowWrap: "anywhere",
  },
  repository: {
    // The repository's name after "Uraeda" wraps anywhere too, inside the button's one-line label.
    overflowWrap: "anywhere",
    whiteSpace: "normal",
  },
  trigger: {
    // The heading's trigger: "Uraeda | repository" on one line, wrapping when it must, and the
    // chevron at its end.
    height: "auto",
    justifyContent: "space-between",
    minHeight: sizeVars["--size-element-md"],
    paddingInlineStart: spacingVars["--spacing-1"],
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
  isCursor,
  onPick,
  onRemove,
  row,
}: {
  current: string | null;
  /** The row the arrows are on, which Enter opens: tinted as a list's selected row. */
  isCursor: boolean;
  onPick: (name: string) => void;
  onRemove: (name: string) => void;
  row: Row;
}) {
  return (
    <ListItem
      xstyle={isCursor ? styles.cursor : undefined}
      description={
        row.missing ? (
          <div {...stylex.props(styles.path)}>
            <StatusText tone="error" type="supporting">
              Folder not found: {row.home}
            </StatusText>
          </div>
        ) : (
          <Text color="secondary" display="block" type="supporting" xstyle={styles.path}>
            {row.home}
          </Text>
        )
      }
      endContent={
        <ActionsMenu
          items={[{ label: "Remove from Uraeda", onClick: () => onRemove(row.name) }]}
          label={`More for ${row.name}`}
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

/** The menu's content: the filter, the list's problem, the rows, a refused removal, and Add. */
function Menu({
  current,
  onAdd,
  onPick,
  onRemovedCurrent,
}: {
  current: string | null;
  onAdd: () => void;
  onPick: (name: string) => void;
  onRemovedCurrent: () => void;
}) {
  const fate = useFateClient();
  const list = useRepositories();
  const [filter, setFilter] = useState("");
  const [refused, setRefused] = useState<string>();
  const needle = filter.trim().toLowerCase();
  const rows = (list?.rows ?? []).filter(
    (row) => row.name.toLowerCase().includes(needle) || row.home.toLowerCase().includes(needle),
  );
  // The row the arrows are on, which Enter opens: at first the latest other than the current one,
  // where a switch goes; once a letter is typed, the first that matches.
  const [moved, setMoved] = useState<number>();
  // The focus in the filter once the menu is drawn, its list read: typing filters at once, and the
  // arrows move along the rows. The dialog's own focus goes to its title as it opens, before.
  const field = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const frame = requestAnimationFrame(() => field.current?.focus());
    return () => cancelAnimationFrame(frame);
  }, []);
  const first =
    needle === ""
      ? Math.max(
          rows.findIndex((row) => row.name !== current),
          0,
        )
      : 0;
  const cursor = Math.min(moved ?? first, rows.length - 1);

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
        ref={field}
        label="Filter repositories"
        onChange={(value: string) => {
          setFilter(value);
          setMoved(undefined);
        }}
        onKeyDown={(event: React.KeyboardEvent<HTMLInputElement>) => {
          // The arrows move along the rows from the field, and Enter opens the one they are on.
          if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault();
            const by = event.key === "ArrowDown" ? 1 : -1;
            setMoved(Math.min(Math.max(cursor + by, 0), rows.length - 1));
          } else if (event.key === "Enter" && rows[cursor] !== undefined) {
            event.preventDefault();
            onPick(rows[cursor].name);
          }
        }}
        placeholder="Filter repositories"
        startIcon="search"
        value={filter}
      />
      {list?.problem && <AnnouncedBanner collapsible={false} status="error" title={list.problem} />}
      <List aria-label="Repositories" density="compact">
        {rows.map((row, index) => (
          <RepositoryRow
            current={current}
            isCursor={index === cursor}
            key={row.name}
            onPick={onPick}
            onRemove={(name) => void remove(name)}
            row={row}
          />
        ))}
      </List>
      {refused && <AnnouncedBanner collapsible={false} status="error" title={refused} />}
      <List aria-label="Add" density="compact">
        <ListItem
          label="Add a repository…"
          onClick={onAdd}
          startContent={<span aria-hidden="true">+</span>}
        />
      </List>
    </VStack>
  );
}

/**
 * The navigation's heading as the menu's trigger: "Uraeda | " and the current repository's name, or
 * "Uraeda" alone on a page of none, with a chevron, after the logo with `hasLogo`. It opens the menu, and
 * the menu the add form.
 */
export function RepositoryMenu({
  current,
  hasLogo = false,
}: {
  current: string | null;
  hasLogo?: boolean;
}) {
  return (
    <OnListClient>
      <MenuTrigger current={current} hasLogo={hasLogo} />
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

/**
 * The menu's content and the add form it leads to, over the caller's `isOpen` state: `isDeferred`
 * says the menu is an overlay, whose sheet's history entry is gone before what follows runs, as on
 * narrow screens, and not a popover.
 */
function useSwitcher(
  current: string | null,
  isDeferred: boolean,
  setOpen: (open: boolean) => void,
) {
  const [adding, setAdding] = useState(false);

  /** Closes the menu, then runs what follows once its sheet's history entry is gone. */
  const closeThen = (run: () => void) => {
    setOpen(false);
    if (isDeferred) {
      afterOverlayCloses(MENU, run);
    } else {
      run();
    }
  };
  const menu = (
    <Suspense fallback={<Spinner label="Loading the repositories" />}>
      <Menu
        current={current}
        onAdd={() => closeThen(() => setAdding(true))}
        onPick={(name) => closeThen(() => navigate(repoPath(name, "/")))}
        onRemovedCurrent={() => closeThen(() => navigate("/"))}
      />
    </Suspense>
  );
  const form = (
    <Drawn isOpen={adding} label={FORM} onClose={() => setAdding(false)}>
      <AddRepository
        onAdded={(name) => {
          setAdding(false);
          afterOverlayCloses(FORM, () => navigate(repoPath(name, "/")));
        }}
        onCancel={() => setAdding(false)}
      />
    </Drawn>
  );
  return { form, menu };
}

function MenuTrigger({ current, hasLogo }: { current: string | null; hasLogo: boolean }) {
  const wide = !isNarrow(useWidthClass());
  const [open, setOpen] = useState(false);
  const { form, menu } = useSwitcher(current, !wide, setOpen);
  const label = current === null ? "Uraeda" : `Uraeda ${current}`;

  const trigger = (
    <Button
      endContent={<Icon icon="chevronDown" />}
      {...(hasLogo ? { icon: <Logo /> } : {})}
      label={label}
      // A picker, as `Space r` opens it: its dialog on wide screens, its sheet here on the phone.
      onClick={wide ? openRepositoryMenu : () => setOpen(true)}
      variant="ghost"
      width="100%"
      xstyle={styles.trigger}
    >
      <span {...stylex.props(styles.names)}>
        {current === null ? (
          <span {...stylex.props(styles.brand)}>Uraeda</span>
        ) : (
          <>
            <Text color="secondary" type="supporting">
              Uraeda
            </Text>
            {/* Its accessible name, the label, is the text it shows, words apart. */}{" "}
            <Text aria-hidden color="secondary" type="supporting">
              |
            </Text>{" "}
            <span {...stylex.props(styles.brand, styles.repository)}>{current}</span>
          </>
        )}
      </span>
    </Button>
  );

  return (
    <>
      {trigger}
      {!wide && (
        <Drawn isOpen={open} label={MENU} onClose={() => setOpen(false)}>
          {menu}
        </Drawn>
      )}
      {form}
    </>
  );
}

/** Whether the menu a key opened is open: the one host in the shell draws it. */
let isKeyOpen = false;
const keyListeners = new Set<() => void>();

function setKeyOpen(open: boolean) {
  isKeyOpen = open;
  for (const listener of keyListeners) {
    listener();
  }
}

/**
 * Opens the repository menu from a key, `Space r`: the navigation's heading may be folded away, or
 * on a page that has none, so the menu is its own dialog (a sheet on narrow screens), drawn by
 * `RepositoryMenuHost`. A click on the heading opens the same dialog on wide screens, as every
 * picker is one.
 */
export function openRepositoryMenu() {
  setKeyOpen(true);
}

/** The key-opened menu's state, drawn from its opening until its history entry is gone. */
function KeyedMenu({ current }: { current: string | null }) {
  const isOpen = useSyncExternalStore(
    (listener) => {
      keyListeners.add(listener);
      return () => void keyListeners.delete(listener);
    },
    () => isKeyOpen,
    () => false,
  );
  const { form, menu } = useSwitcher(current, true, setKeyOpen);
  // The page it was opened on goes, and the menu with it.
  useEffect(() => () => setKeyOpen(false), []);
  return (
    <>
      <Drawn isOpen={isOpen} label={MENU} onClose={() => setKeyOpen(false)}>
        {menu}
      </Drawn>
      {form}
    </>
  );
}

/** Draws the menu `openRepositoryMenu` opens, on the global client; mounted once, in the shell. */
export function RepositoryMenuHost({ current }: { current: string | null }) {
  return (
    <OnListClient>
      <KeyedMenu current={current} />
    </OnListClient>
  );
}
