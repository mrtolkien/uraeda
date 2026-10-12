import { BreadcrumbItem, Breadcrumbs } from "@astryxdesign/core/Breadcrumbs";
import { spacingVars } from "@astryxdesign/core/theme/tokens.stylex";
import * as stylex from "@stylexjs/stylex";
import { useWorkspace } from "./data.ts";

const styles = stylex.create({
  crumbs: {
    marginBlockEnd: spacingVars["--spacing-3"],
  },
  // A crumb's link fills its item, which the theme makes a control's height under a touch pointer.
  item: {
    alignItems: "stretch",
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
      <BreadcrumbItem href="/" xstyle={styles.item}>
        Home
      </BreadcrumbItem>
      {current === undefined ? (
        <BreadcrumbItem isCurrent xstyle={styles.item}>
          {title}
        </BreadcrumbItem>
      ) : (
        <>
          <BreadcrumbItem href={`/f/${folder}`} xstyle={styles.item}>
            {title}
          </BreadcrumbItem>
          <BreadcrumbItem isCurrent xstyle={styles.item}>
            {current}
          </BreadcrumbItem>
        </>
      )}
    </Breadcrumbs>
  );
}
