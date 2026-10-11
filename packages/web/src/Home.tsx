import { Badge } from "@astryxdesign/core/Badge";
import { Banner } from "@astryxdesign/core/Banner";
import { Button } from "@astryxdesign/core/Button";
import { useState } from "react";
import { useFateClient } from "react-fate";
import { useWorkspace } from "./data.ts";
import { refusal } from "./errors.ts";
import { DraftView } from "./views.ts";
import { stepLabel, waiting } from "./labels.ts";
import { Link, navigate } from "./routes.tsx";

/** The home screen: what waits on the human, what agents do, the next priorities, what is done. */
export function Home() {
  const workspace = useWorkspace();
  const fate = useFateClient();
  const [error, setError] = useState<string>();
  if (!workspace) {
    return null;
  }
  if (workspace.noSpecs) {
    return (
      <div className="page">
        <Banner
          status="warning"
          title={`No specs/ folder in ${workspace.noSpecs}. Set Uraeda up with ura init.`}
        />
      </div>
    );
  }
  const features = workspace.features;
  const human = features.filter((f) => f.step.waitsOn === "human" && !f.problems.length);
  const agents = features.filter(
    (f) => f.step.waitsOn === "agent" && f.step.name !== "none" && !f.problems.length,
  );
  const invalid = features.filter((f) => f.problems.length && f.step.name !== "done");
  const done = features.filter((f) => f.step.name === "done");
  const priorities = workspace.priorities.filter(
    (entry) => (entry.section === "now" || entry.section === "next") && !entry.feature,
  );

  const draft = async (id: string) => {
    setError(undefined);
    const result = await fate.mutations.draft.create({ input: { line: id }, view: DraftView });
    if (result.error) {
      setError(refusal(result.error).message);
    } else if (typeof result.result?.path === "string") {
      navigate(`/edit/${result.result.path}`);
    }
  };

  return (
    <div className="page">
      {!human.length && (
        <div style={{ marginBottom: 14 }}>
          <Banner status="info" title="Nothing waits on you." />
        </div>
      )}
      {human.length > 0 && <div className="group label">Waiting on you</div>}
      {human.map((feature) => {
        const { verb, line, href } = waiting(feature);
        return (
          <Link key={feature.folder} to={href} className="row">
            <Badge variant="warning" label={verb} />
            <span className="grow">
              {feature.title}
              {line && <div className="sub">{line}</div>}
            </span>
            <span className="chevron">›</span>
          </Link>
        );
      })}
      {invalid.length > 0 && <div className="group label">Files to fix</div>}
      {invalid.map((feature) => (
        <Link key={feature.folder} to={`/f/${feature.folder}`} className="row">
          <Badge variant="error" label="Problems" />
          <span className="grow">
            {feature.title}
            <div className="sub">{feature.problems[0].message}</div>
          </span>
          <span className="chevron">›</span>
        </Link>
      ))}
      {agents.length > 0 && <div className="group label">Agents at work</div>}
      {agents.map((feature) => (
        <Link key={feature.folder} to={`/f/${feature.folder}`} className="row">
          <Badge variant="info" label={stepLabel(feature.step.name)} />
          <span className="grow">
            {feature.title}
            {feature.step.task && <div className="sub">{feature.step.task}</div>}
          </span>
          <span className="chevron">›</span>
        </Link>
      ))}
      {priorities.length > 0 && <div className="group label">Priorities</div>}
      {priorities.map((entry) => (
        <div key={entry.id} className="row">
          <span className="grow">
            {entry.text}
            <div className="sub">
              {entry.section === "now" ? "Now" : "Next"}
              {entry.draft && <span className="mono"> · {entry.draft.replace("specs/", "")}</span>}
            </div>
          </span>
          {entry.draft ? (
            <Button label="Start" onClick={() => navigate(`/edit/${entry.draft}`)} />
          ) : !entry.link ? (
            <Button label="Draft" clickAction={() => draft(entry.id)} />
          ) : null}
        </div>
      ))}
      {error && <p className="not-saved">{error}</p>}
      <Link to="/priorities" className="row">
        <span className="grow">All priorities</span>
        <span className="chevron">›</span>
      </Link>
      {done.length > 0 && <div className="group label">Done</div>}
      {done.map((feature) => (
        <Link key={feature.folder} to={`/f/${feature.folder}`} className="row">
          <Badge variant="success" label="Merged" />
          <span className="grow">{feature.title}</span>
          <span className="chevron">›</span>
        </Link>
      ))}
    </div>
  );
}
