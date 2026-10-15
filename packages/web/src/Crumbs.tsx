import { BreadcrumbItem, Breadcrumbs } from "@astryxdesign/core/Breadcrumbs";
import { spacingVars } from "@astryxdesign/core/theme/tokens.stylex";
import * as stylex from "@stylexjs/stylex";
import { useWorkspace } from "./data.ts";
import { useRepoPath } from "./routes.tsx";

const styles = stylex.create({
  crumbs: {
    marginBlockEnd: spacingVars["--spacing-3"],
  },
  item: {
    // A crumb's link fills its item, which the theme makes a control's height under a touch pointer.
    alignItems: "stretch",
  },
});

/**
 * Where a page sits: Home, its feature, and the page itself when it is inside the feature, like a
 * file. The feature is named by its title, read with the navigation's workspace. A session's page
 * is "Session" inside its feature, but a change's is the change's own page (US4.6), which has no
 * other page to go back to: it has no crumbs.
 */
export function Crumbs({
  current,
  folder,
  session = false,
}: {
  current?: string;
  folder: string;
  /** Whether the page is the item's session, named "Session" inside a feature. */
  session?: boolean;
}) {
  const workspace = useWorkspace();
  const here = useRepoPath();
  const item = workspace?.features.find((feature) => feature.folder === folder);
  if (session && item?.kind === "change") {
    return null;
  }
  const title = item?.title ?? folder;
  const page = session ? "Session" : current;
  return (
    <Breadcrumbs label="Breadcrumbs" separator="›" xstyle={styles.crumbs}>
      <BreadcrumbItem href={here("/")} xstyle={styles.item}>
        Home
      </BreadcrumbItem>
      {page === undefined ? (
        <BreadcrumbItem isCurrent xstyle={styles.item}>
          {title}
        </BreadcrumbItem>
      ) : (
        <>
          <BreadcrumbItem href={here(`/f/${folder}`)} xstyle={styles.item}>
            {title}
          </BreadcrumbItem>
          <BreadcrumbItem isCurrent xstyle={styles.item}>
            {page}
          </BreadcrumbItem>
        </>
      )}
    </Breadcrumbs>
  );
}
