// The app's route table: the page an address names, and the address a page writes. The paths are
// the React UI's (`packages/web/src/routeTable.ts`), so a link from before the port still opens.
// An address read once per navigation is no heavy logic: it stays in TSX, with no native call.

/** What the New page starts: a session, a change, or a feature. */
export type NewKind = "change" | "feature" | "session";

/** The folder of the main checkout, among the features' folders: its stories have no feature. */
export const MAIN_CHECKOUT = "main";

/** The app's pages, each with what its path names. */
type Page =
  | { page: "home" }
  | { folder: string; page: "feature" }
  | { folder: string; name: string; page: "file" }
  | { folder: string; name: string; page: "mockup" }
  | { folder: string; name: string; page: "branch-decision" }
  | { folder: string; page: "session" }
  // A story of a feature's Storybook, or of the main checkout's, named by the query `?story=`.
  | { folder: string; page: "storybook"; story: string }
  | { page: "priorities" }
  | { key: string; page: "proposal" }
  | { page: "inbox" }
  | { key: string; page: "note" }
  | { page: "triage" }
  | { page: "decisions" }
  | { page: "decisions-check" }
  | { name: string; page: "decision" }
  | { page: "constitution" }
  | { page: "git" }
  | { page: "jobs" }
  | { name: string; page: "job" }
  | { page: "job-new" }
  | { page: "sessions" }
  | { id: string; page: "session-id" }
  // The kind the query `?kind=` names: none leaves the choice to the page.
  | { kind?: NewKind; page: "new" }
  | { category?: string; page: "settings" }
  | { page: "edit"; path: string }
  | { page: "buffer"; path: string }
  // An extension's place, `/e/<name>/<id>…`: `rest` is the path after its name.
  | { name: string; page: "extension"; rest: string }
  // No page: `path` is the address's path within its repository.
  | { page: "missing"; path: string };

/** What a page reads from its address's query, `?…`, by name: a name without a value holds "". */
export type Query = Readonly<Record<string, string>>;

/**
 * A page of the app, with the rest of its address: the repository it is in, `/r/<name>`, which an
 * address from before repositories had names lacks; its query, less what the page's own fields
 * hold; and its hash, `#…`, decoded, which names a block of the page.
 */
export type Route = Page & {
  readonly hash?: string;
  readonly query?: Query;
  readonly repo?: string;
};

/** The route of the page `P`, with its fields: what the screen registered for `P` is given. */
export type RouteOf<P extends Route["page"]> = Extract<Route, { page: P }>;

/** A page found, with the hash an old address stands for. */
type Found = Page & { hash?: string };

/** What reads the segments after a path's first one, decoded, and may take from the query. */
type Place = (rest: Array<string>, query: Map<string, string>) => Found | undefined;

/** A repository's prefix, `/r/<name>`, and the page's path after it. */
const PREFIX = /^\/r\/([^/]+)(\/.*)?$/;

/** The text an escaped segment stands for: as it is, when a browser would refuse it. */
function decode(text: string): string {
  try {
    return decodeURIComponent(text);
  } catch {
    return text;
  }
}

/** Takes the page's own parameter `name` out of the query. */
function take(query: Map<string, string>, name: string): string | undefined {
  const value = query.get(name);
  query.delete(name);
  return value;
}

/** The New page, with the kind the query names: Session for one it does not know. */
function newPage(query: Map<string, string>): Found {
  const kind = take(query, "kind");
  if (kind === undefined) {
    return { page: "new" };
  }
  return { kind: kind === "change" || kind === "feature" ? kind : "session", page: "new" };
}

/** The page of the story the query names in the Storybook of `folder`, if it names one. */
function storyPage(folder: string, query: Map<string, string>): Found | undefined {
  const story = take(query, "story");
  return story ? { folder, page: "storybook", story } : undefined;
}

/** The pages under a feature's folder, `/f/<folder>…`. */
const featurePlace: Place = (rest, query) => {
  const [folder, name, last] = rest;
  if (rest.length === 1) {
    return { folder, page: "feature" };
  }
  if (rest.length === 2 && name === "session") {
    return { folder, page: "session" };
  }
  // The old Storybook address without a story is the feature's page.
  if (rest.length === 2 && name === "storybook") {
    return storyPage(folder, query) ?? { folder, page: "feature" };
  }
  if (rest.length === 2) {
    return { folder, name, page: "file" };
  }
  if (rest.length === 3 && name === "mockups") {
    return { folder, name: last, page: "mockup" };
  }
  if (rest.length === 3 && name === "decisions") {
    return { folder, name: last, page: "branch-decision" };
  }
  // An old run's address: its feature's session, at the turn the run became.
  if (rest.length === 3 && name === "runs") {
    return { folder, hash: `turn-${last}`, page: "session" };
  }
  return undefined;
};

/** `/jobs`, `/jobs/new`, and a job's page, less the `~` that `jobPath` puts before its name. */
const jobsPlace: Place = ([name, ...more]) => {
  if (more.length > 0) {
    return undefined;
  }
  if (name === undefined) {
    return { page: "jobs" };
  }
  if (name === "new") {
    return { page: "job-new" };
  }
  return { name: name.startsWith("~") ? name.slice(1) : name, page: "job" };
};

/**
 * `/decisions`, `/decisions/check`, `/decisions/constitution`, one page, or `/decisions/<name>`. An
 * old link to a principle, `/decisions/constitution/<slug>`, opens the constitution.
 */
const decisionsPlace: Place = (rest) => {
  if (rest.length === 0) {
    return { page: "decisions" };
  }
  if (rest.length === 1 && rest[0] === "check") {
    return { page: "decisions-check" };
  }
  if (rest.length <= 2 && rest[0] === "constitution") {
    return { page: "constitution" };
  }
  return rest.length === 1 ? { name: rest[0], page: "decision" } : undefined;
};

/** The page `page` alone at its path, and nothing under it. */
function alone(page: Found): Place {
  return (rest) => (rest.length === 0 ? page : undefined);
}

/** The page `list` at its path, and the page `item` makes of the one segment under it. */
function listed(list: Found, item: (name: string) => Found): Place {
  return (rest) => {
    if (rest.length === 0) {
      return list;
    }
    return rest.length === 1 ? item(rest[0]) : undefined;
  };
}

/** A page named by all the path under its first segment, like a file's from the top level. */
function under(page: (path: string) => Found): Place {
  return (rest) => (rest.length > 0 ? page(rest.join("/")) : undefined);
}

/** What each first segment of a path opens. */
const PLACES = new Map<string, Place>([
  ["f", featurePlace],
  ["priorities", listed({ page: "priorities" }, (key) => ({ key, page: "proposal" }))],
  [
    "inbox",
    listed({ page: "inbox" }, (key) =>
      key === "triage" ? { page: "triage" } : { key, page: "note" },
    ),
  ],
  ["decisions", decisionsPlace],
  ["git", alone({ page: "git" })],
  ["jobs", jobsPlace],
  ["sessions", listed({ page: "sessions" }, (id) => ({ id, page: "session-id" }))],
  ["new", (rest, query) => (rest.length === 0 ? newPage(query) : undefined)],
  ["settings", listed({ page: "settings" }, (category) => ({ category, page: "settings" }))],
  ["edit", under((path) => ({ page: "edit", path }))],
  ["buffer", under((path) => ({ page: "buffer", path }))],
  [
    "e",
    ([name, ...rest]) =>
      name === undefined ? undefined : { name, page: "extension", rest: rest.join("/") },
  ],
  // The old Storybook address of the main checkout: a story's page, or Home without one.
  [
    "storybook",
    (rest, query) =>
      rest.length === 0 ? (storyPage(MAIN_CHECKOUT, query) ?? { page: "home" }) : undefined,
  ],
  // The addresses from before sessions, kept so links in old transcripts still open.
  [
    "chats",
    (rest, query) => {
      if (rest.length !== 1) {
        return undefined;
      }
      return rest[0] === "new" ? newPage(query) : { id: rest[0], page: "session-id" };
    },
  ],
  [
    "changes",
    (rest, query) => {
      if (rest.length !== 1 || rest[0] !== "new") {
        return undefined;
      }
      // The new address's own kind wins over one the old address names.
      take(query, "kind");
      return { kind: "change", page: "new" };
    },
  ],
  // The Commit page's address, from before the Git page replaced it.
  ["commit", alone({ page: "git" })],
]);

/** The page at `local`, a path within a repository. */
function pageAt(local: string, query: Map<string, string>): Found {
  const [first, ...rest] = local.split("/").filter(Boolean).map(decode);
  if (first === undefined) {
    return { page: "home" };
  }
  return PLACES.get(first)?.(rest, query) ?? { page: "missing", path: local };
}

/** An address's path, its query without `?`, and its hash without `#`. */
function split(address: string): { hash: string; path: string; search: string } {
  const hashAt = address.indexOf("#");
  const before = hashAt === -1 ? address : address.slice(0, hashAt);
  const queryAt = before.indexOf("?");
  return {
    hash: hashAt === -1 ? "" : address.slice(hashAt + 1),
    path: queryAt === -1 ? before : before.slice(0, queryAt),
    search: queryAt === -1 ? "" : before.slice(queryAt + 1),
  };
}

/** A query's parameters by name: the first value of a name given twice. */
function queryOf(search: string): Map<string, string> {
  const query = new Map<string, string>();
  new URLSearchParams(search).forEach((value, name) => {
    if (!query.has(name)) {
      query.set(name, value);
    }
  });
  return query;
}

/**
 * The route an address names: its path, with its query and its hash. An address from before a page
 * moved names the page where it is now, so no screen redirects it.
 */
export function parseRoute(address: string): Route {
  const { hash, path, search } = split(address);
  const prefixed = PREFIX.exec(path);
  const query = queryOf(search);
  const { hash: stood, ...page } = pageAt(prefixed ? (prefixed[2] ?? "/") : path, query);
  const anchor = stood ?? decode(hash);
  return {
    ...page,
    ...(anchor === "" ? {} : { hash: anchor }),
    ...(query.size === 0 ? {} : { query: Object.fromEntries(query) }),
    ...(prefixed ? { repo: decode(prefixed[1]) } : {}),
  };
}

const segment = encodeURIComponent;

/** A path of several segments, like a file's from the top level, each encoded. */
function segments(path: string): string {
  return path.split("/").map(segment).join("/");
}

/**
 * A job's page, by its name: the name encoded, with a `~` before it when it would be another page
 * (`new`, the new job's), a dot segment a browser would normalise away, or itself start with `~`.
 */
function jobPath(name: string): string {
  const plain = name !== "new" && name !== "." && name !== ".." && !name.startsWith("~");
  return `/jobs/${plain ? "" : "~"}${segment(name)}`;
}

/** A page's path within its repository. */
function localPath(route: Route): string {
  switch (route.page) {
    case "home":
      return "/";
    case "feature":
      return `/f/${segment(route.folder)}`;
    case "file":
      return `/f/${segment(route.folder)}/${segment(route.name)}`;
    case "mockup":
      return `/f/${segment(route.folder)}/mockups/${segment(route.name)}`;
    case "branch-decision":
      return `/f/${segment(route.folder)}/decisions/${segment(route.name)}`;
    case "session":
      return `/f/${segment(route.folder)}/session`;
    case "storybook":
      return route.folder === MAIN_CHECKOUT
        ? "/storybook"
        : `/f/${segment(route.folder)}/storybook`;
    case "priorities":
      return "/priorities";
    case "proposal":
      return `/priorities/${segment(route.key)}`;
    case "inbox":
      return "/inbox";
    case "note":
      return `/inbox/${segment(route.key)}`;
    case "triage":
      return "/inbox/triage";
    case "decisions":
      return "/decisions";
    case "decisions-check":
      return "/decisions/check";
    case "decision":
      return `/decisions/${segment(route.name)}`;
    case "constitution":
      return "/decisions/constitution";
    case "git":
      return "/git";
    case "jobs":
      return "/jobs";
    case "job":
      return jobPath(route.name);
    case "job-new":
      return "/jobs/new";
    case "sessions":
      return "/sessions";
    case "session-id":
      return `/sessions/${segment(route.id)}`;
    case "new":
      return "/new";
    case "settings":
      return route.category === undefined ? "/settings" : `/settings/${segment(route.category)}`;
    case "edit":
      return `/edit/${segments(route.path)}`;
    case "buffer":
      return `/buffer/${segments(route.path)}`;
    case "extension":
      return `/e/${segment(route.name)}${route.rest === "" ? "" : `/${segments(route.rest)}`}`;
    case "missing":
      return route.path;
  }
}

/** The parameters a page's own fields write in its query. */
function ownQuery(route: Route): Query {
  if (route.page === "new" && route.kind !== undefined) {
    return { kind: route.kind };
  }
  return route.page === "storybook" ? { story: route.story } : {};
}

/** The address of a route, as `parseRoute` reads it: its path, then its query and its hash. */
export function pathOf(route: Route): string {
  const prefix = route.repo === undefined ? "" : `/r/${segment(route.repo)}`;
  const search = Object.entries({ ...route.query, ...ownQuery(route) })
    .map(([name, value]) => (value === "" ? segment(name) : `${segment(name)}=${segment(value)}`))
    .join("&");
  const hash = route.hash ? `#${segment(route.hash)}` : "";
  return `${prefix}${localPath(route)}${search === "" ? "" : `?${search}`}${hash}`;
}
