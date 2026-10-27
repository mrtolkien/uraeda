import { AnnouncedBanner } from "./layout/AnnouncedBanner.tsx";
import { Button } from "@astryxdesign/core/Button";
import { LayerProvider } from "@astryxdesign/core/Layer";
import { LinkProvider } from "@astryxdesign/core/Link";
import { Text } from "@astryxdesign/core/Text";
import { Theme } from "@astryxdesign/core/theme";
import { uraedaTheme } from "./theme/built/uraeda.js";
import {
  Component,
  type ReactNode,
  Suspense,
  useDeferredValue,
  useLayoutEffect,
  useState,
} from "react";
import { FateClient } from "react-fate";
import type { FateClient as Client } from "./clients.ts";
import { MAIN_CHECKOUT, usePreview, useRepositories } from "./data.ts";
import { useDropGuard } from "./attach/useImageDrop.ts";
import { CheckPage } from "./decisions/CheckPage.tsx";
import { DecisionsPage, type LedgerOpen } from "./decisions/DecisionsPage.tsx";
import { FeaturePage } from "./feature/FeaturePage.tsx";
import { ConfirmHost } from "./fields/Confirm.tsx";
import { LeaveGuard } from "./fields/LeaveGuard.tsx";
import { pruneUnsaved } from "./fields/unsaved.ts";
import { CommitPage } from "./CommitPage.tsx";
import { EditorPage } from "./EditorPage.tsx";
import { FilePage } from "./FilePage.tsx";
import { MockupPage } from "./MockupPage.tsx";
import { BranchDecisionPage } from "./decisions/BranchDecision.tsx";
import { NewPage } from "./NewPage.tsx";
import { Page as PageLayout } from "./layout/Page.tsx";
import { isNarrow, useWidthClass } from "./layout/useWidthClass.ts";
import { ListPaneContext, useListPane } from "./lists/listPane.ts";
import { InboxRoute, PrioritiesRoute } from "./pane/DetailRoutes.tsx";
import { RouterAnchor } from "./links.tsx";
import {
  currentEntry,
  navigate,
  RepositoryContext,
  RepositoryPathContext,
  repoPath,
  type Route,
  redirect,
  useEntryId,
  useRepoPath,
  useRestoreScroll,
  useRoute,
  useSearch,
} from "./routes.tsx";
import { ListClientContext, useOpenRepository } from "./RepositoryMenu.tsx";
import { FirstRun, MissingFolder, UnknownRepository } from "./RepositoryPages.tsx";
import { SessionPage } from "./SessionPage.tsx";
import { SettingsPage } from "./settings/SettingsPage.tsx";
import { StoryPage, storyOf } from "./StoryPage.tsx";
import { TriagePage } from "./TriagePage.tsx";
import { Shell } from "./Shell.tsx";
import { SessionsPage } from "./shell/SessionsPage.tsx";
import { SignInPage } from "./sign-in/SignInPage.tsx";
import { useSignedOut } from "./sign-in/signedOut.ts";
import { ThemeModeProvider } from "./theme.tsx";
import { Missing } from "./layout/Missing.tsx";

/** Shows that the server could not be reached, with a way to try again. */
class ServerErrorBoundary extends Component<
  { children: ReactNode; onRetry: () => void },
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    if (!this.state.failed) {
      return this.props.children;
    }
    return (
      <PageLayout>
        <AnnouncedBanner
          endContent={
            <Button
              label="Try again"
              onClick={() => {
                this.setState({ failed: false });
                this.props.onRetry();
              }}
            />
          }
          status="error"
          title="Could not reach the Uraeda server."
        />
      </PageLayout>
    );
  }
}

/**
 * What draws a page anew: its address, except for a list with the overlay of a line over it, which
 * stays drawn while the overlay opens, closes, and shows another line, and keeps its selection, its
 * scroll, and its focus; and the decisions page with its reader, which stays drawn while the reader
 * follows the list's keys to another row in the same history entry: on the decisions page, from a
 * principle to a decision too.
 */
function pageKey(route: Route, pathname: string, entryId: string | undefined) {
  if (route.page === "decisions" || route.page === "decision" || route.page === "principle") {
    return `ledger:${entryId}`;
  }
  switch (route.page) {
    case "home":
    case "priorities":
    case "task":
      return "priorities";
    case "inbox":
    case "note":
      return "inbox";
    default:
      return pathname;
  }
}

/** The page of the route, and the Storybook of its feature started. */
function Page({ route }: { route: Route }) {
  return (
    <>
      <RoutePage route={route} />
      <StartsStorybook route={route} />
    </>
  );
}

function RoutePage({ route }: { route: Route }) {
  switch (route.page) {
    case "home":
      return <PrioritiesRoute isHome />;
    case "feature":
      return <ItemPage folder={route.folder} />;
    case "file":
      return <FilePage folder={route.folder} name={route.name} />;
    case "priorities":
      return <PrioritiesRoute isHome={false} />;
    case "task":
      // A line opened from home draws its overlay over home.
      return <PrioritiesRoute entryKey={route.key} isHome={currentEntry().from === "/"} />;
    case "note":
      return <InboxRoute noteKey={route.key} />;
    case "inbox":
      return <InboxRoute />;
    case "triage":
      return <TriagePage />;
    case "decisions-check":
      return <CheckPage />;
    case "decisions":
      return <LedgerRoute open={undefined} />;
    case "decision":
      return <LedgerRoute open={{ kind: "decision", name: route.name }} />;
    case "principle":
      return <LedgerRoute open={{ kind: "principle", slug: route.slug }} />;
    case "commit":
      return <CommitPage />;
    case "edit":
      return <EditorPage key={route.path} path={route.path} />;
    case "mockup":
      return <MockupPage folder={route.folder} name={route.name} />;
    case "branch-decision":
      return <BranchDecisionPage folder={route.folder} name={route.name} />;
    case "session":
      return <SessionRoute folder={route.folder} />;
    case "storybook":
      return <StoryRoute folder={route.folder} />;
    case "run":
      return <RunRedirect folder={route.folder} id={route.id} />;
    case "session-id":
      return <SessionPage id={route.id} key={route.id} />;
    case "sessions":
      return <SessionsPage />;
    case "new":
      return <NewPage kind={route.kind} />;
    case "moved":
      return <Moved path={route.path} />;
    case "first-run":
      return <FirstRun />;
    case "settings":
      return <SettingsPage category={route.category} />;
    default:
      return <Nothing />;
  }
}

/**
 * The decisions page with its reader, on what is open or the constitution: on wide screens, beside
 * the constitution and the decisions; on narrow screens, what is open is a page of its own. The
 * list's keys show another item in it, and Escape returns it to the constitution.
 */
function LedgerRoute({ open }: { open: LedgerOpen | undefined }) {
  const here = useRepoPath();
  const pane = useListPane(() => navigate(here("/decisions")));
  useListPosition();
  return (
    <ListPaneContext value={pane}>
      <DecisionsPage onClose={pane.close} open={open} />
    </ListPaneContext>
  );
}

/**
 * On wide screens, keeps the list beside a detail where it was when the detail was opened, unless
 * the entry has a position of its own.
 */
function useListPosition() {
  // Once, when the view is drawn, at the width it is drawn at: the entry is read once too.
  const width = useWidthClass();
  const [wide] = useState(!isNarrow(width));
  const [{ opener, scroll }] = useState(currentEntry);
  useLayoutEffect(() => {
    if (wide && scroll === undefined && opener !== undefined) {
      window.scrollTo(0, opener);
    }
  }, [wide, opener, scroll]);
}

/**
 * Starts the Storybook of the feature or change whose page is shown, any page under its folder, and
 * keeps it running while one of its pages shows, so its stories are ready once one is embedded: a
 * read of its record is a view. Draws nothing, and holds no page back while the record loads.
 */
function StartsStorybook({ route }: { route: Route }) {
  const folder = "folder" in route ? route.folder : undefined;
  return folder === undefined ? null : (
    <Suspense fallback={null}>
      <ReadPreview folder={folder} />
    </Suspense>
  );
}

/** Reads a checkout's Storybook record, which starts it. */
function ReadPreview({ folder }: { folder: string }) {
  usePreview(folder);
  return null;
}

/** A feature's page, or a change's: the same page for both. */
function ItemPage({ folder }: { folder: string }) {
  return <FeaturePage folder={folder} />;
}

/** A feature's session: a page of its own at every width. */
function SessionRoute({ folder }: { folder: string }) {
  return <SessionPage folder={folder} />;
}

/**
 * The old Storybook address: with `?story=`, the story's page; without, the feature's page, or Home
 * for the main checkout's, which no longer has a page of its own.
 */
function StoryRoute({ folder }: { folder: string }) {
  const here = useRepoPath();
  const story = storyOf(useSearch());
  useLayoutEffect(() => {
    if (!story) {
      redirect(here(folder === MAIN_CHECKOUT ? "/" : `/f/${encodeURIComponent(folder)}`));
    }
  }, [folder, here, story]);
  return story ? <StoryPage folder={folder} story={story} /> : null;
}

/** An old run's address: its feature's session, at the turn the run became. */
function RunRedirect({ folder, id }: { folder: string; id: string }) {
  const here = useRepoPath();
  useLayoutEffect(() => {
    redirect(here(`/f/${encodeURIComponent(folder)}/session#turn-${encodeURIComponent(id)}`));
  }, [here, folder, id]);
  return null;
}

/**
 * An address from before sessions: the same page at its new one, with its query and its hash. The
 * new address's own query comes first, and wins over a parameter of the same name.
 */
function Moved({ path }: { path: string }) {
  const here = useRepoPath();
  useLayoutEffect(() => {
    const [page, own = ""] = path.split("?");
    const target = new URLSearchParams(own);
    const query = new URLSearchParams(own);
    for (const [name, value] of new URLSearchParams(window.location.search)) {
      if (!target.has(name)) {
        query.append(name, value);
      }
    }
    const search = query.size > 0 ? `?${query}` : "";
    redirect(`${here(page)}${search}${window.location.hash}`);
  }, [here, path]);
  return null;
}

function Nothing() {
  useRestoreScroll(true);
  return (
    <PageLayout>
      <Missing title="Nothing here." />
    </PageLayout>
  );
}

function Loading() {
  return (
    <PageLayout>
      <Text color="secondary">Loading…</Text>
    </PageLayout>
  );
}

/**
 * A path without a repository, from before repositories had names: the same page in the most
 * recently opened repository, or the first run when the list is empty.
 */
function ToMostRecent({ name, pathname }: { name?: string; pathname: string }) {
  useLayoutEffect(() => {
    if (name !== undefined) {
      redirect(`${repoPath(name, pathname)}${window.location.search}${window.location.hash}`);
    }
  }, [name, pathname]);
  return name === undefined ? <FirstRun /> : null;
}

/**
 * The repository the URL names, from the list the global client reads: its pages, on its own fate
 * client, under its name; or why it cannot be shown, without sending it a request.
 */
function InRepository({
  children,
  clientFor,
  pathname,
  repo,
}: {
  children: ReactNode;
  clientFor: (repo: string | null) => Client;
  pathname: string;
  repo: string | null;
}) {
  const rows = useRepositories()?.rows ?? [];
  const mostRecent = rows[0]?.name;
  const row = repo === null ? undefined : rows.find((candidate) => candidate.name === repo);
  // Its page shown, the repository moves first in the list.
  useOpenRepository(row && !row.missing ? row.name : null);
  if (repo === null) {
    return <ToMostRecent name={mostRecent} pathname={pathname} />;
  }
  if (!row) {
    return <UnknownRepository mostRecent={mostRecent} name={repo} />;
  }
  if (row.missing) {
    return <MissingFolder name={row.name} path={row.path} />;
  }
  // The repository menu changes the list on the global client, which this gate reads.
  return (
    <ListClientContext value={clientFor(null)}>
      <RepositoryContext value={repo}>
        <RepositoryPathContext value={row.path}>
          <FateClient client={clientFor(repo)} key={repo}>
            {children}
          </FateClient>
        </RepositoryPathContext>
      </RepositoryContext>
    </ListClientContext>
  );
}

/**
 * The UI: the list of repositories through the global client, `clientFor(null)`, and the page of
 * the repository the URL names through its own, `clientFor(<name>)`, its tree drawn anew for each
 * repository. Signed out, the sign-in screen instead, which reloads the page once signed in, or
 * calls `onSignedIn`.
 */
export function App({
  clientFor,
  onSignedIn,
}: {
  clientFor: (repo: string | null) => Client;
  onSignedIn?: () => void;
}) {
  const { pathname, repo, route } = useRoute();
  // A step behind, as the route is.
  const entryId = useDeferredValue(useEntryId());
  const [attempt, setAttempt] = useState(0);
  const signedOut = useSignedOut();
  // Unsaved text older than 30 days goes as the app starts, before a field shows it.
  useState(() => pruneUnsaved(new Date()));
  useDropGuard();
  // The device's setting, kept above the repository-keyed client so a repository switch keeps it.
  const keysSwitch = useState(true);
  return (
    <FateClient client={clientFor(null)}>
      <ThemeModeProvider>
        {(mode) => (
          <Theme mode={mode} theme={uraedaTheme}>
            <LinkProvider component={RouterAnchor}>
              <LayerProvider toast={{ position: "bottomEnd" }}>
                <ConfirmHost>
                  <LeaveGuard />
                  {signedOut ? (
                    <SignInPage onSignedIn={onSignedIn} />
                  ) : (
                    <ServerErrorBoundary key={attempt} onRetry={() => setAttempt((n) => n + 1)}>
                      <Suspense fallback={<Loading />}>
                        <InRepository clientFor={clientFor} pathname={pathname} repo={repo}>
                          <Suspense fallback={<Loading />}>
                            <Shell keysSwitch={keysSwitch}>
                              <Suspense fallback={<Loading />}>
                                <Page key={pageKey(route, pathname, entryId)} route={route} />
                              </Suspense>
                            </Shell>
                          </Suspense>
                        </InRepository>
                      </Suspense>
                    </ServerErrorBoundary>
                  )}
                </ConfirmHost>
              </LayerProvider>
            </LinkProvider>
          </Theme>
        )}
      </ThemeModeProvider>
    </FateClient>
  );
}
