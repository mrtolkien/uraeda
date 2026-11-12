// What a repository lacks to be set up, at the head of Needs you: a repository with no `specs/`
// folder, or whose setup is not finished, says so, with what is missing and the way out, instead
// of a Home that reads as set up and empty. The server says what is missing (`Workspace.setup`,
// `noSpecs`); the setup itself is the agent's, from a chat, after `ura init` writes the folder.
import { View } from "nsh";
import { navigate, record } from "../../store";
import type { Workspace } from "../../store/protocol";
import { Banner, Button } from "../../ui/controls";

/** The banner's words, or none for a repository set up. */
function setUpWords(workspace: Workspace | undefined): { title: string; words: string } | null {
  if (workspace === undefined) return null;
  const chat =
    "then start a chat, Space n s, and ask the agent to set Uraeda up: it writes the constitution and the decisions with you.";
  if (workspace.noSpecs !== null) {
    return {
      title: "Not set up for Uraeda yet",
      words: `It has no specs/ folder, where the workflow's files live. Run ura init in ${workspace.noSpecs} to write it, ${chat}`,
    };
  }
  const missing = workspace.setup.filter((item) => item.required && item.state !== "written");
  if (missing.length === 0) return null;
  const names = missing.map((item) =>
    item.state === "template" ? `${item.name} (still the template)` : item.name,
  );
  return {
    title: "The setup is not finished",
    words: `Still to write: ${names.join(", ")}. Start a chat, Space n s, and ask the agent to finish Uraeda's setup.`,
  };
}

export function SetUp(props: { repo: string }) {
  const workspace = record("Workspace", { repo: props.repo });
  return (
    <If when={setUpWords(workspace())}>
      {(said) => (
        <View style={{ marginBottom: 10 }}>
          <Banner
            action={
              <Button
                icon="message-square"
                label="New chat"
                onPress={() => navigate({ kind: "session", page: "new" })}
              />
            }
            icon="folder-plus"
            testID="home-set-up"
            title={said().title}
            tone="needs"
          >
            {said().words}
          </Banner>
        </View>
      )}
    </If>
  );
}
