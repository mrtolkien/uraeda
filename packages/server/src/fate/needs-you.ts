// What needs the human across every repository the server has, on the global endpoint, for the
// notifications (see `specs/decisions/notifications.md`): each item whose status asks something of
// the human, from the statuses the sidebar shows, with what it asks and where to answer it.
import { dataView } from "@nkzw/fate/server";
import type { FeatureView } from "uraeda-binding";
import type { SessionStatus, StatusReason } from "../runner/status.ts";
import type { Context, RepoContext } from "./context.ts";
import { itemLooks } from "./items.ts";
import { chatStatuses, featureStatuses } from "./sessions.ts";

/** Why an item needs the human, in the order a notification picks it. */
export type NeedsYouReason = "blocked" | "attention" | "step" | "pull-request";

/** An item that needs the human. */
export type NeedsYouRow = {
  /** The feature's folder; a chat has none. */
  folder?: string;
  /** Its page, from the server's root: where the human answers it. */
  href: string;
  /** `<repository>/<folder>`, or `<repository>/chats/<session id>`. */
  id: string;
  /** Changes with the reason and the step or the turn, so a new ask notifies again. */
  key: string;
  /** Its name in the sidebar, or its slug. */
  label: string;
  /** What it asks: "Questions to answer". */
  message: string;
  reason: NeedsYouReason;
  repository: string;
  title: string;
};

export type NeedsYouListRecord = { id: string; rows: Array<NeedsYouRow> };

export const NEEDS_YOU_ID = "all";

export const needsYouListDataView = dataView<NeedsYouListRecord>("NeedsYouList")({
  id: true,
  rows: true,
});

/** Why a status needs the human, or nothing: a refused action, a run that ended early, a step. */
export function needsYouReason(input: {
  status: SessionStatus;
  statusReason: StatusReason | null;
  step: string;
}): NeedsYouReason | undefined {
  if (input.statusReason === "blocked") {
    return "blocked";
  }
  if (input.status === "attention") {
    return "attention";
  }
  if (input.status === "needs-you") {
    return input.step === "pull-request" ? "pull-request" : "step";
  }
  return undefined;
}

/** What a gate asks, by the kind of file it waits on. */
const ASKS: Record<string, string> = {
  clarifications: "Questions to answer",
  plan: "The plan to review",
  proposal: "The proposal to write",
  spec: "The spec to review",
};

const REFUSED = "The agent was refused an action";

function messageOf(feature: FeatureView, reason: NeedsYouReason, why: StatusReason | null) {
  switch (reason) {
    case "blocked":
      return REFUSED;
    case "attention":
      return why === "failed" ? "The run failed" : "The run stopped before a gate";
    case "pull-request":
      return `Pull request #${feature.pullRequest?.number ?? ""} is ready for review`;
    case "step": {
      const kind = feature.files.find((file) => file.name === feature.step.file)?.kind;
      return (kind && ASKS[kind]) ?? "A step to take";
    }
  }
}

function hrefOf(name: string, feature: FeatureView, reason: NeedsYouReason) {
  const base = `/r/${name}`;
  if (reason === "blocked" || reason === "attention") {
    return `${base}/f/${feature.folder}/session`;
  }
  if (reason === "step" && feature.step.file) {
    const kind = feature.files.find((file) => file.name === feature.step.file)?.kind;
    return kind === "proposal"
      ? `${base}/edit/${feature.path}/${feature.step.file}`
      : `${base}/f/${feature.folder}/${feature.step.file}`;
  }
  return `${base}/f/${feature.folder}`;
}

/** The chats of one repository whose latest turn was refused an action: archived ones are put away. */
async function chatRowsOf(ctx: RepoContext, name: string): Promise<Array<NeedsYouRow>> {
  return (await chatStatuses(ctx)).flatMap(({ latest, row, status, statusReason, title }) => {
    if (needsYouReason({ status, statusReason, step: "" }) !== "blocked") {
      return [];
    }
    const id = `${name}/chats/${row.id}`;
    return [
      {
        href: `/r/${name}/chats/${row.id}`,
        id,
        key: `${id}:blocked:${latest?.id ?? ""}`,
        label: title,
        message: REFUSED,
        reason: "blocked" as const,
        repository: name,
        title,
      },
    ];
  });
}

/** The items of one repository that need the human: its features, then its chats. */
async function rowsOf(ctx: RepoContext, name: string): Promise<Array<NeedsYouRow>> {
  return [...(await featureRowsOf(ctx, name)), ...(await chatRowsOf(ctx, name))];
}

async function featureRowsOf(ctx: RepoContext, name: string): Promise<Array<NeedsYouRow>> {
  const looks = itemLooks(ctx);
  return (await featureStatuses(ctx)).flatMap(({ feature, status, statusReason }) => {
    const reason = needsYouReason({ status, statusReason, step: feature.step.name });
    if (!reason) {
      return [];
    }
    const id = `${name}/${feature.folder}`;
    return [
      {
        folder: feature.folder,
        href: hrefOf(name, feature, reason),
        id,
        key: `${id}:${reason}:${feature.step.name}:${feature.step.file ?? ""}:${statusReason ?? ""}`,
        label: looks(feature.folder).label ?? feature.slug,
        message: messageOf(feature, reason, statusReason),
        reason,
        repository: name,
        title: feature.title,
      },
    ];
  });
}

/** Every listed repository's items that need the human; a repository that cannot be read is left out. */
export async function needsYouList(ctx: Context): Promise<NeedsYouListRecord> {
  const hosts = ctx.hosts.all().filter((host) => !host.missing);
  const rows = await Promise.all(
    hosts.map((host) => rowsOf({ ...ctx, repo: host.path }, host.name).catch(() => [])),
  );
  return { id: NEEDS_YOU_ID, rows: rows.flat() };
}
