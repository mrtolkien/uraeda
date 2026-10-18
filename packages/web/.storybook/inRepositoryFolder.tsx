// The decorator of the stories that render a page of the fixture's files, as the app does.
import type { Decorator } from "@storybook/react-vite";
import type { ReactNode } from "react";
import { useWorkspace } from "../src/data.ts";
import { RepositoryPathContext } from "../src/routes.tsx";

/** The fixture's folder, as `App` sets it: what keeps a page's unsaved text apart. */
function InRepositoryFolder({ children }: { children: ReactNode }) {
  const root = useWorkspace()?.root;
  return root === undefined ? null : (
    <RepositoryPathContext value={root}>{children}</RepositoryPathContext>
  );
}

/** Renders a story inside the fixture's folder. */
export const inRepositoryFolder: Decorator = (Story) => (
  <InRepositoryFolder>
    <Story />
  </InRepositoryFolder>
);
