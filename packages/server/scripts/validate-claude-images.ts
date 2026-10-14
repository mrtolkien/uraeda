/**
 * The image checks of `validate-claude.ts`: a chat image the agent reads by its path, in a data
 * folder whose path holds a space, only because the images folder is added, and an image a
 * proposal links, which the agent opens as the skill says. And the wrapper around `claude` that
 * they and the allow rule's check run.
 */
import { randomUUID } from "node:crypto";
import { chmodSync, copyFileSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { attachImage, encodeImage } from "uraeda-binding";
import { fixture } from "uraeda-binding/test-utils";
import type { AgentProcess } from "../src/runner/adapter.ts";
import { ClaudeAdapter, PLUGIN_DIR } from "../src/runner/claude.ts";
import type { AgentEvent } from "../src/runner/events.ts";
import { ChatImages } from "../src/runner/images.ts";

/** What the checks share with `validate-claude.ts`: its folders. */
export type Env = { configDir: string; outside: string };

/** `validate-claude.ts`'s run of one message, with the paths of the images it sends. */
type Run = (
  message: string,
  sessionId: string,
  resume: boolean,
  onEvent?: (event: AgentEvent, agent: AgentProcess) => void,
  agentAdapter?: ClaudeAdapter,
  images?: Array<{ path: string }>,
) => Promise<Array<AgentEvent>>;

/**
 * The chat images' folder of a data folder in `outside`, as the server's, whose path holds a space,
 * as macOS's `Application Support` does: the images' paths and `--add-dir` must keep it. Through
 * its symbolic links, as macOS's `/tmp`.
 */
export const imagesFolder = (outside: string) =>
  join(realpathSync(outside), "uraeda data", "images");

/** A run's result event. */
const resultOf = (events: Array<AgentEvent>) =>
  events.find((event): event is Extract<AgentEvent, { type: "result" }> => event.type === "result");

/**
 * Whether two paths name the same file, through symbolic links: the agent may give the path it was
 * sent, or one through another link, as macOS's `/tmp` and `/private/tmp`.
 */
function samePath(a: unknown, b: string): boolean {
  return typeof a === "string" && (a === b || realPath(a) === realPath(b));
}

/** A path through its symbolic links, or as it is when it does not exist. */
function realPath(path: string) {
  try {
    return realpathSync(path);
  } catch {
    return path;
  }
}

/** Whether a run read the file at `path` with its Read tool, and the read did not fail. */
const readFile = (events: Array<AgentEvent>, path: string) =>
  events.some(
    (event) =>
      event.type === "toolStart" &&
      event.name === "Read" &&
      samePath(event.input.file_path, path) &&
      events.some((end) => end.type === "toolEnd" && end.id === event.id && !end.isError),
  );

/** Whether a run's reads of the file at `path` were refused. */
const readDenied = (events: Array<AgentEvent>, path: string) =>
  (resultOf(events)?.denials ?? []).some(
    (denial) => denial.tool === "Read" && samePath(denial.input.file_path, path),
  );

/** The tools a run called, and their inputs, when a check fails. */
const tools = (events: Array<AgentEvent>) =>
  events.flatMap((event) => (event.type === "toolStart" ? [[event.name, event.input]] : []));

/**
 * Claude Code through a wrapper script in `outside`: with `--settings <file>` when `settings` is
 * given, and with the `default` permission mode in place of the runner's `auto` when `strict` is,
 * so that a read outside the working folders is refused in print mode, which cannot ask.
 */
export function wrappedAdapter(
  { configDir, outside }: Env,
  name: string,
  { settings, strict = false }: { settings?: string; strict?: boolean },
) {
  const wrapper = join(outside, name);
  const prefix = settings === undefined ? "" : ` --settings '${settings}'`;
  writeFileSync(
    wrapper,
    strict
      ? [
          "#!/bin/sh",
          "prev=",
          'for arg in "$@"; do',
          "  shift",
          '  if [ "$prev" = --permission-mode ]; then next=default; else next=$arg; fi',
          "  prev=$arg",
          '  set -- "$@" "$next"',
          "done",
          `exec claude${prefix} "$@"`,
          "",
        ].join("\n")
      : `#!/bin/sh\nexec claude${prefix} "$@"\n`,
  );
  chmodSync(wrapper, 0o755);
  return new ClaudeAdapter({
    command: wrapper,
    configDir,
    imagesDir: imagesFolder(outside),
    pluginDir: PLUGIN_DIR,
  });
}

/**
 * The seventh and eighth checks, run in the fixture's copy at `cwd`, reported through `report`.
 */
export async function imageChecks(
  env: Env & {
    cwd: string;
    report: (name: string, ok: boolean, got: unknown) => void;
    run: Run;
  },
): Promise<void> {
  const { cwd, outside, report, run } = env;
  const images = new ChatImages(imagesFolder(outside));
  // 7. A chat image, saved in the data folder as the server saves it, is read by its path, with
  // no permission prompt (US6.2), only because its folder is added: in the `default` permission
  // mode, the same image copied outside the working folders is refused. No rule can block reads
  // outside the project but not in the images folder, which is outside it too (R41).
  const screenshot = readFileSync(fixture("images/desktop.png"));
  const chatImage = await images.save(await encodeImage(screenshot, "desktop.png"));
  const chatPath = join(images.dir, chatImage.id);
  const elsewhere = join(outside, chatImage.id);
  copyFileSync(chatPath, elsewhere);
  const strict = wrappedAdapter(env, "claude-default-mode", { strict: true });
  const describe = "What does this screenshot show? Answer in one sentence.";
  const chat = await run(describe, randomUUID(), false, undefined, strict, [{ path: chatPath }]);
  const control = await run(describe, randomUUID(), false, undefined, strict, [
    { path: elsewhere },
  ]);
  report(
    "a chat image is read by its path, in a folder with a space, because its folder is added",
    readFile(chat, chatPath) &&
      !readDenied(chat, chatPath) &&
      resultOf(chat)?.ok === true &&
      readDenied(control, elsewhere) &&
      !readFile(control, elsewhere),
    {
      control: { result: resultOf(control), tools: tools(control) },
      result: resultOf(chat),
      tools: tools(chat),
    },
  );

  // 8. An image a proposal links is opened by an agent asked about the proposal, as the skill
  // says (US6.1).
  const proposal = "specs/2026-10-10-cli-core/proposal.md";
  const attached = await attachImage(cwd, proposal, screenshot, "login.png");
  const proposalPath = join(cwd, proposal);
  writeFileSync(
    proposalPath,
    `${readFileSync(proposalPath, "utf8").trimEnd()}\n\n${attached.link}\n`,
  );
  const linkedPath = join(cwd, attached.path);
  const asked = await run(
    `/uraeda:uraeda Do not continue the workflow, and change no file. What does ${proposal} ask for? Answer in two sentences.`,
    randomUUID(),
    false,
  );
  report(
    "an image a proposal links is opened with the proposal",
    readFile(asked, linkedPath) && resultOf(asked)?.ok === true,
    { result: resultOf(asked), tools: tools(asked) },
  );
}
