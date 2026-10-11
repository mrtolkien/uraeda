import { Blocks } from "./Blocks.tsx";
import { useFile } from "./data.ts";
import { Link } from "./routes.tsx";

/** A workflow file, drawn from the core's document tree. */
export function DocumentPage({ folder, name }: { folder: string; name: string }) {
  const file = useFile(folder, name);
  if (!file) {
    return (
      <div className="page">
        <p>
          No file {name} in <Link to={`/f/${folder}`}>{folder}</Link>.
        </p>
      </div>
    );
  }
  return (
    <div className="page">
      <p className="small muted">
        <Link to={`/f/${folder}`}>{folder}</Link> › <span className="mono">{name}</span>
      </p>
      <Blocks document={file.current.document} />
    </div>
  );
}
