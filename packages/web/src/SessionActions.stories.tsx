// A session's actions, in the "…" beside its composer's Send, by the session's workflow: none, a
// change, or a feature; the line a started change leaves on its session; and the confirmation of
// "Drop the change…". The menu and the confirmation are the app's own; their actions reach Uraeda's
// server in Storybook.
import type { Meta, StoryObj } from "@storybook/react-vite";
import { useEffect } from "react";
import { ConfirmHost, useConfirm } from "./fields/Confirm.tsx";
import { Page } from "./layout/Page.tsx";
import { addNote } from "./offers.ts";
import { dropQuestion, SessionActions as Actions, type SessionItem } from "./SessionActions.tsx";
import { SessionEnd } from "./SessionOffers.tsx";
import type { Controls } from "./useSessionControls.ts";

const CHANGE: SessionItem = {
  branch: "change/2026-10-20-login-redirect",
  folder: "2026-10-20-login-redirect",
  kind: "change",
  slug: "login-redirect",
};

/** A session's controls, which do nothing here. */
const controls = (archived?: boolean): Controls => ({
  allow: async () => {},
  allowAll: async () => {},
  archive: archived === undefined ? undefined : { archived, onArchive: async () => {} },
  error: undefined,
  fail: () => {},
  rename: undefined,
});

/** The session started as a change: the line its card leaves. */
addNote("story-started", {
  status: "info",
  title: "Started as the change Login redirects twice, on change/2026-10-20-login-redirect",
});

/** Asks "Drop the change login-redirect?" as the session's "…" does, once drawn. */
function DropQuestion() {
  const confirm = useConfirm();
  useEffect(() => {
    void confirm(dropQuestion(CHANGE, CHANGE.branch!));
  }, [confirm]);
  return null;
}

const meta = {
  args: {
    controls: controls(false),
    isMenuOpen: true,
    session: { folder: null, id: "story", title: "Why does the login redirect twice?" },
  },
  component: Actions,
  decorators: [
    (Story) => (
      <Page isSnug>
        <Story />
      </Page>
    ),
  ],
  parameters: { layout: "fullscreen" },
  title: "Session page/Actions",
} satisfies Meta<typeof Actions>;

export default meta;

type Story = StoryObj<typeof meta>;

/** A session's actions, open beside Send: make it a change, rename, archive. */
export const SessionActions: Story = {};

/** Once started: the session says so, and its actions offer a feature, and dropping the change. */
export const ChangeStarted: Story = {
  args: {
    controls: controls(),
    item: CHANGE,
    session: {
      folder: CHANGE.folder,
      id: "story-started",
      title: "Why does the login redirect twice?",
    },
  },
  render: (args) => (
    <>
      <SessionEnd id="story-started" turns={[]} />
      <Actions {...args} />
    </>
  ),
};

/** A feature's actions: rename, and dropping the feature. */
export const FeatureActions: Story = {
  args: {
    controls: controls(),
    item: {
      ...CHANGE,
      branch: "2026-10-20-priorities-sections",
      kind: "feature",
      slug: "priorities-sections",
    },
    session: {
      folder: "2026-10-20-priorities-sections",
      id: "story",
      title: "Priorities sections",
    },
  },
};

/** "Drop the change…" picked in the change's actions: what goes, and what stays. */
export const DropChange: Story = {
  args: { controls: controls(), isMenuOpen: false, item: CHANGE },
  render: (args) => (
    <ConfirmHost>
      <Actions {...args} />
      <DropQuestion />
    </ConfirmHost>
  ),
};
