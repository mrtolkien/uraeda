// What a page shows when the thing its address names is not there: an error with the way out, the
// same on every page (UI coherence); and a repository without a `specs/` folder.
import { Banner } from "@astryxdesign/core/Banner";
import { Link } from "@astryxdesign/core/Link";
import { useRepoPath } from "../routes.tsx";
import { AnnouncedBanner } from "./AnnouncedBanner.tsx";

/**
 * What a page cannot find, "No file spec.md in 2026-10-11-web-ui.", and a link out of it: to `to`,
 * a path in the repository, named `label`, or home.
 */
export function Missing({
  label = "Open home",
  title,
  to = "/",
}: {
  label?: string;
  title: string;
  to?: string;
}) {
  const here = useRepoPath();
  return (
    <AnnouncedBanner
      collapsible={false}
      description={
        <Link hasUnderline href={here(to)}>
          {label}
        </Link>
      }
      status="error"
      title={title}
    />
  );
}

/** A page of a repository without a `specs/` folder: the folder, and how to set Uraeda up. */
export function NoSpecs({ path }: { path: string }) {
  return (
    <Banner status="warning" title={`No specs/ folder in ${path}. Set Uraeda up with ura init.`} />
  );
}
