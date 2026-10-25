// A feature's links: its Storybook, its pull request, and its mockups. Task 7 moves them to the
// Home's column.
import { List, ListItem } from "@astryxdesign/core/List";
import { useRepoPath } from "../routes.tsx";
import { storybookHref } from "../stories.tsx";

/** What the links read of the feature. */
export type LinksFeature = {
  folder: string;
  mockups: Array<string>;
  preview?: unknown;
  pullRequest?: { number: number; url: string } | null;
};

/** The feature's Storybook, its pull request, and its HTML mockups, when it has any. */
export function Links({ feature }: { feature: LinksFeature }) {
  const here = useRepoPath();
  const { mockups, preview, pullRequest } = feature;
  if (!preview && !pullRequest && mockups.length === 0) {
    return null;
  }
  return (
    <List aria-label="Links" density="compact" hasDividers>
      {preview ? (
        <ListItem
          description="The feature's stories, live"
          href={here(storybookHref(feature.folder))}
          label="Storybook"
        />
      ) : null}
      {pullRequest && (
        // In a new tab, as "Next" opens it.
        <ListItem
          description="On GitHub"
          href={pullRequest.url}
          label={`Pull request #${pullRequest.number}`}
          rel="noopener noreferrer"
          target="_blank"
        />
      )}
      {mockups.map((name) => (
        <ListItem
          description="Mockup"
          href={here(`/f/${feature.folder}/mockups/${name}`)}
          key={name}
          label={name}
        />
      ))}
    </List>
  );
}
