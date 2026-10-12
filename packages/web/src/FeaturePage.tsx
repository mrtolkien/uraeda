import { Badge } from "@astryxdesign/core/Badge";
import { Button } from "@astryxdesign/core/Button";
import { Suspense } from "react";
import { AgentPanel } from "./AgentPanel.tsx";
import { useFeature } from "./data.ts";
import { waiting, workflowOrder } from "./labels.ts";
import { Link, navigate, useRestoreScroll } from "./routes.tsx";

function statusVariant(status?: string) {
  switch (status) {
    case "awaiting-human":
      return "warning";
    case "approved":
    case "answered":
    case "auto-approved":
      return "success";
    case "changes-requested":
      return "error";
    default:
      return "neutral";
  }
}

/** A feature: what waits on the human, its branch, its files in workflow order, its problems. */
export function FeaturePage({ folder }: { folder: string }) {
  const feature = useFeature(folder);
  // Its data is read before it draws: the position comes back at once.
  useRestoreScroll(true);
  if (!feature) {
    return (
      <div className="page">
        <p>No feature {folder}.</p>
      </div>
    );
  }
  const gate = feature.step.waitsOn === "human" ? waiting(feature) : undefined;
  const files = workflowOrder(feature.files).filter((file) => file.kind !== "review");
  const finished = feature.files.some((file) => file.kind === "record");
  const left =
    feature.leftWorktree && feature.leftBranch
      ? "Worktree and branch left"
      : feature.leftWorktree
        ? "Worktree left"
        : feature.leftBranch
          ? "Branch left"
          : undefined;
  const missing =
    feature.kind === "feature" && !finished
      ? ["spec.md", "plan.md"].filter((name) => !feature.files.some((f) => f.name === name))
      : [];
  const problemFiles = new Set(feature.problems.map((p) => p.file));
  return (
    <div className="page">
      <h1 className="title-l">{feature.title}</h1>
      {gate && (
        <div className="callout important" style={{ marginBottom: 14 }}>
          <span className="callout-title">{gate.title}</span>
          {gate.line && <p>{gate.line}</p>}
          <div className="actions">
            <Button variant="primary" label={gate.verb} onClick={() => navigate(gate.href)} />
          </div>
        </div>
      )}
      <Suspense fallback={null}>
        <AgentPanel feature={feature} />
      </Suspense>
      <p className="small muted">
        {feature.branch ? (
          <>
            Branch <span className="mono">{feature.branch}</span>
            {feature.worktree && feature.worktree !== "." && (
              <>
                {" "}
                in <span className="mono">{feature.worktree}</span>
              </>
            )}
          </>
        ) : (
          "Merged into the default branch"
        )}
        {feature.uncommitted && " · uncommitted changes"}
      </p>
      {left && (
        <div className="callout" style={{ marginBottom: 14 }}>
          <span className="callout-title">{left}</span>
          <p className="small">
            {feature.leftWorktree && <span className="mono">{feature.leftWorktree}</span>}
            {feature.leftWorktree && feature.leftBranch && " and the branch "}
            {!feature.leftWorktree && "The branch "}
            {feature.leftBranch && <span className="mono">{feature.leftBranch}</span>}
            {feature.leftWorktree && feature.leftBranch ? " are" : " is"} still there. Run{" "}
            <span className="mono">ura clean</span> to remove{" "}
            {feature.leftWorktree && feature.leftBranch ? "them" : "it"}.
          </p>
        </div>
      )}
      {files.map((file) => (
        <Link key={file.name} to={`/f/${folder}/${file.name}`} className="row">
          <span className="grow mono">{file.name}</span>
          {problemFiles.has(`specs/${folder}/${file.name}`) && (
            <Badge variant="error" label="problem" />
          )}
          <Badge
            variant={statusVariant(file.status)}
            label={file.kind === "record" ? "record" : (file.status ?? "committed")}
          />
          <span className="chevron">›</span>
        </Link>
      ))}
      {missing.map((name) => (
        <div key={name} className="row muted">
          <span className="grow mono">{name}</span>
          <Badge variant="neutral" label="not yet" />
        </div>
      ))}
      {feature.problems.length > 0 && <div className="group label">Problems</div>}
      {feature.problems.map((problem, index) => (
        <div key={index} className="row">
          <span className="grow">
            <span className="mono">
              {problem.file.split("/").pop()}
              {problem.line ? `:${problem.line}` : ""}
            </span>
            <div>{problem.message}</div>
          </span>
        </div>
      ))}
    </div>
  );
}
