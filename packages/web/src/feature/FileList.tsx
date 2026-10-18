// A feature's workflow files, as compact rows, beside its links: its Storybook, its pull request,
// and its mockups.
import { Badge } from "@astryxdesign/core/Badge";
import { Grid } from "@astryxdesign/core/Grid";
import { List, ListItem } from "@astryxdesign/core/List";
import { Text } from "@astryxdesign/core/Text";
import { useWidthClass } from "../layout/useWidthClass.ts";
import { useRepoPath } from "../routes.tsx";
import { type StepKind, StepIcon } from "../sidebar/StepIcon.tsx";
import { storybookHref } from "../stories.tsx";

/** A workflow file, as the core summarises it. */
type File = { kind: string; name: string; round?: number | null; status?: string | null };

/** What the list reads of the feature. */
export type FilesFeature = {
  files: Array<File>;
  folder: string;
  kind: string;
  mockups: Array<string>;
  preview?: unknown;
  pullRequest?: { number: number; url: string } | null;
};

/** Each kind of file: its name in words, and its step's icon. */
const KINDS: Record<string, { icon: StepKind; name: string }> = {
  clarifications: { icon: "questions", name: "Questions" },
  "data-model": { icon: "spec", name: "Data model" },
  discovery: { icon: "discovery", name: "Discovery" },
  plan: { icon: "plan", name: "Plan" },
  proposal: { icon: "proposal", name: "Proposal" },
  record: { icon: "done", name: "Record" },
  rulings: { icon: "plan", name: "Rulings" },
  spec: { icon: "spec", name: "Spec" },
};

/** A file's name in words, "Questions, round 01", and its icon. */
function named(file: File) {
  const kind = KINDS[file.kind] ?? { icon: "proposal" as const, name: file.name };
  const round = file.round ? `, round ${String(file.round).padStart(2, "0")}` : "";
  return { icon: kind.icon, name: `${kind.name}${round}` };
}

/** A status's colour: every finished state green, waiting on you amber, a request red (C6). */
function statusVariant(status: string): "neutral" | "warning" | "success" | "error" {
  switch (status) {
    case "committed":
    case "answered":
    case "approved":
    case "auto-approved":
    case "record":
      return "success";
    case "awaiting-human":
      return "warning";
    case "changes-requested":
      return "error";
    default:
      return "neutral";
  }
}

/** The files in workflow order, then the spec and plan a feature does not have yet. */
function Files({ feature }: { feature: FilesFeature }) {
  const here = useRepoPath();
  // The core sends them in workflow order; a review is read on its file's page.
  const files = feature.files.filter((file) => file.kind !== "review");
  const finished = feature.files.some((file) => file.kind === "record");
  const missing =
    feature.kind === "feature" && !finished
      ? (["spec", "plan"] as const).filter((kind) => !feature.files.some((f) => f.kind === kind))
      : [];
  return (
    <List aria-label="Files" density="compact" hasDividers>
      {files.map((file) => {
        const { icon, name } = named(file);
        const status = file.kind === "record" ? "record" : (file.status ?? "committed");
        return (
          <ListItem
            endContent={<Badge label={status} variant={statusVariant(status)} />}
            href={here(`/f/${feature.folder}/${file.name}`)}
            key={file.name}
            label={<Text>{name}</Text>}
            startContent={<StepIcon step={icon} />}
          />
        );
      })}
      {missing.map((kind) => (
        <ListItem
          endContent={<Badge label="not yet" variant="neutral" />}
          key={kind}
          label={<Text color="secondary">{KINDS[kind]!.name}</Text>}
          startContent={<StepIcon step={kind} />}
        />
      ))}
    </List>
  );
}

/** The feature's Storybook, its pull request, and its HTML mockups, when it has any. */
function Links({ feature }: { feature: FilesFeature }) {
  const here = useRepoPath();
  const { mockups, preview, pullRequest } = feature;
  if (!preview && !pullRequest && mockups.length === 0) {
    return null;
  }
  return (
    <List aria-label="Links" density="compact" hasDividers>
      {preview ? (
        <ListItem
          description="The feature's stories, live"
          href={here(storybookHref(feature.folder))}
          label="Storybook"
        />
      ) : null}
      {pullRequest && (
        <ListItem
          description="On GitHub"
          href={pullRequest.url}
          label={`Pull request #${pullRequest.number}`}
        />
      )}
      {mockups.map((name) => (
        <ListItem
          description="Mockup"
          href={here(`/f/${feature.folder}/mockups/${name}`)}
          key={name}
          label={name}
        />
      ))}
    </List>
  );
}

/** The files beside the links on a wide screen, each half the width; stacked on the phone. */
export function FileList({ feature }: { feature: FilesFeature }) {
  const wide = useWidthClass() === "wide";
  return (
    <Grid columns={wide ? 2 : 1} gap={4}>
      <Files feature={feature} />
      <Links feature={feature} />
    </Grid>
  );
}
