import { BreadcrumbItem, Breadcrumbs } from "@astryxdesign/core/Breadcrumbs";
import { spacingVars } from "@astryxdesign/core/theme/tokens.stylex";
import * as stylex from "@stylexjs/stylex";
import { useWorkspace } from "./data.ts";

const styles = stylex.create({
  crumbs: {
    marginBlockEnd: spacingVars["--spacing-3"],
  },
});

/**
 * Where a page sits: Home, its feature, and the page itself when it is inside the feature, like a
 * file. The feature is named by its title, read with the navigation's workspace.
 */
export function Crumbs({ folder, current }: { folder: string; current?: string }) {
  const workspace = useWorkspace();
  const title = workspace?.features.find((feature) => feature.folder === folder)?.title ?? folder;
  return (
    <Breadcrumbs label="Breadcrumbs" separator="›" xstyle={styles.crumbs}>
      <BreadcrumbItem href="/">Home</BreadcrumbItem>
      {current === undefined ? (
        <BreadcrumbItem isCurrent>{title}</BreadcrumbItem>
      ) : (
        <>
          <BreadcrumbItem href={`/f/${folder}`}>{title}</BreadcrumbItem>
          <BreadcrumbItem isCurrent>{current}</BreadcrumbItem>
        </>
      )}
    </Breadcrumbs>
  );
}
