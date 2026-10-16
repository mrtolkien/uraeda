// The settings page's states, as the spec's mockups: each category, the Server category with a
// value a flag overrides and with a file that cannot be read, and the phone's list of categories.
// The Server values are the page's own view of them, passed in, until the server's settings source
// exists; Sign-in and Appearance are the real ones.
import type { Meta, StoryObj } from "@storybook/react-vite";
import { RepositoryPathContext } from "../routes.tsx";
import type { CategoryId } from "./categories.ts";
import type { ServerActions, ServerValues } from "./ServerSettings.tsx";
import { SettingsView } from "./SettingsView.tsx";

/** The settings file of a machine reached through its tailnet name, nothing overridden. */
const server: ServerValues = {
  allowedHosts: {
    inForce: ["mac.tail1234.ts.net"],
    saved: ["mac.tail1234.ts.net"],
    source: { kind: "file" },
  },
  currentHost: "mac.tail1234.ts.net",
  file: "~/.config/uraeda/config.toml",
  openBrowser: { inForce: true, saved: undefined, source: { kind: "default" } },
  port: { inForce: 4310, saved: undefined, source: { kind: "default" } },
};

/** Every change succeeds, and changes nothing: the page's actions are the server's. */
const serverActions: ServerActions = {
  addHost: async () => undefined,
  editHost: async () => undefined,
  removeHost: () => {},
  setOpenBrowser: () => {},
  setPort: async () => undefined,
};

const pathOf = (id: CategoryId) => `#settings/${id}`;

const meta = {
  args: { category: "server", indexPath: "#settings", pathOf, server, serverActions },
  component: SettingsView,
  // The lines edited in place keep their unsaved text under the repository's path.
  decorators: [
    (Story) => (
      <RepositoryPathContext value="/fixture">
        <Story />
      </RepositoryPathContext>
    ),
  ],
  title: "Settings",
} satisfies Meta<typeof SettingsView>;

export default meta;

type Story = StoryObj<typeof meta>;

/** The Server category, from the settings file: one host name, the default port, a browser. */
export const Server: Story = {};

/** Started with `--allowed-hosts` and `URAEDA_PORT`: each says what is in force for this run. */
export const Overridden: Story = {
  args: {
    server: {
      ...server,
      allowedHosts: {
        inForce: ["build.tail1234.ts.net"],
        saved: ["mac.tail1234.ts.net"],
        source: { kind: "flag", name: "--allowed-hosts" },
      },
      port: { inForce: 4400, saved: 4310, source: { kind: "environment", name: "URAEDA_PORT" } },
    },
  },
};

/** A settings file broken by a hand edit: the problem, and no change taken. */
export const Unreadable: Story = {
  args: {
    server: {
      ...server,
      problem:
        "Cannot read ~/.config/uraeda/config.toml: line 3, port: expected a number from 1 to 65535.",
    },
  },
};

/** The theme, on this browser. */
export const Appearance: Story = { args: { category: "appearance" } };

/** Sign out this browser, or every device. */
export const SignIn: Story = { args: { category: "sign-in" } };

/** A category whose settings come with later features. */
export const Runs: Story = { args: { category: "runs" } };

/** No category named: the list on a phone, Server beside it on a desktop. */
export const Index: Story = { args: { category: undefined } };
