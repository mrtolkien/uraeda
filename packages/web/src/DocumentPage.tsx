import { Blocks } from "./Blocks.tsx";
import type { useFile } from "./data.ts";
import { Link } from "./routes.tsx";

type File = NonNullable<ReturnType<typeof useFile>>;

/** A workflow file, drawn from the core's document tree. */
export function DocumentPage({ file }: { file: File }) {
  return (
    <div className="page">
      <p className="small muted">
        <Link to={`/f/${file.folder}`}>{file.folder}</Link> ›{" "}
        <span className="mono">{file.name}</span>
      </p>
      <Blocks document={file.current.document} />
    </div>
  );
}
