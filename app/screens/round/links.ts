// How a round's documents read: its images with the sign-in, its links followed as a workflow
// file's are, and, in a feature's round, a story or a mockup a paragraph links alone shown live.
// A round of the default branch has no feature: its links open their file.
import { navigate } from "../../store";
import type { FileView } from "../../store/protocol";
import type { DocumentHands } from "../../ui/document";
import { follow } from "../file/links";
import { embedAt, imageFor } from "../file/Reader";
import { type RoundArgs, targetOf } from "./saves";

export function linksOf(args: RoundArgs, file: () => FileView): DocumentHands {
  const target = targetOf(args);
  if (target.kind === "default") {
    return {
      image: (image) => imageFor(args.repo, image),
      onLink: (link) => {
        if (link.path !== null) navigate({ page: "edit", path: link.path, repo: args.repo });
      },
    };
  }
  const of = { folder: target.folder, name: target.name, repo: args.repo };
  return {
    image: (image) => imageFor(args.repo, image),
    onLink: (link) => follow(link, of, file().path, file().current.document),
    override: (block) => embedAt(of, file().current, block),
  };
}
