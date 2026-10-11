import { DocumentPage } from "./DocumentPage.tsx";
import { useFile } from "./data.ts";
import { RoundPage } from "./RoundPage.tsx";
import { Link } from "./routes.tsx";

/** A workflow file, on the page its kind needs: a round to answer, or a document to read. */
export function FilePage({ folder, name }: { folder: string; name: string }) {
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
  if (file.kind === "clarifications") {
    return <RoundPage file={file} />;
  }
  return <DocumentPage file={file} />;
}
