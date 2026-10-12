import { DocumentPage } from "./DocumentPage.tsx";
import { useFile } from "./data.ts";
import { ReviewPage } from "./ReviewPage.tsx";
import { RoundPage } from "./RoundPage.tsx";
import { Link } from "./routes.tsx";

/** A workflow file, on the page its kind needs: a round to answer, or a document to read. */
export function FilePage({ folder, name }: { folder: string; name: string }) {
  const file = useFile(folder, name);
  if (!file || file.missing) {
    return (
      <div className="page">
        <p>
          No file {name} in {folder}.
        </p>
        <p>
          <Link to={`/f/${folder}`}>Open the feature</Link>
        </p>
      </div>
    );
  }
  if (file.kind === "clarifications") {
    return <RoundPage file={file} />;
  }
  const reviewed = ["spec", "plan", "assessment"].includes(file.kind);
  if (reviewed && file.status === "awaiting-human") {
    return <ReviewPage file={file} />;
  }
  return <DocumentPage file={file} />;
}
