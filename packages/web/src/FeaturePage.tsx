import { Badge } from "@astryxdesign/core/Badge";
import { Button } from "@astryxdesign/core/Button";
import { useFeature } from "./data.ts";
import { waiting, workflowOrder } from "./labels.ts";
import { Link, navigate } from "./routes.tsx";

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
  if (!feature) {
    return (
      <div className="page">
        <p>No feature {folder}.</p>
      </div>
    );
  }
  const gate = feature.step.waitsOn === "human" ? waiting(feature) : undefined;
  const files = workflowOrder(feature.files).filter((file) => file.kind !== "review");
  const missing =
    feature.kind === "feature"
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
      {files.map((file) => (
        <Link key={file.name} to={`/f/${folder}/${file.name}`} className="row">
          <span className="grow mono">{file.name}</span>
          {problemFiles.has(`specs/${folder}/${file.name}`) && (
            <Badge variant="error" label="problem" />
          )}
          <Badge variant={statusVariant(file.status)} label={file.status ?? "committed"} />
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
