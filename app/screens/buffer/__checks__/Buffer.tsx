// The app, opened on a buffer of the sandbox's `realistic` repository, as `buffer.test.tsx` drives it:
// the real shell over the sandbox `just app-test` starts. The file is the test's own, a note made
// here, so no other test's data changes under it. The test changes it on disk through another
// action, `write`, as an agent would, and reads what the disk holds from `disk`, posted at each
// change of the record.
import { effect, host, mount, signal } from "nsh";
import { call, connection, parseRoute, record, redirect } from "../../../store";
import { boot } from "../../shell/boot";
import { appHost } from "../../shell/host";
import { Root } from "../../shell/Root";

const repo = "realistic";
const path = `specs/notes/editor-check-${Date.now()}.md`;
/** The hash of an empty text: the file does not exist yet. */
const NONE = "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855";
let hash = NONE;

const write = async (text: string) => {
  hash = (await call("buffer.save", { hash, path, repo, text })).hash;
};

host.on("write", (text) => {
  void write(String(text)).then(() => host.post("written", null));
});

/** Posts what the disk holds as the server says it changed. */
function Disk() {
  const buffer = record("Buffer", { path, repo });
  effect(() => {
    const read = buffer();
    if (read) {
      hash = read.hash;
      host.post("disk", read.text);
    }
  });
  return null;
}

/** Whether the note is made: the disk is read from then on. */
const made = signal(false);

/** Waits for the shell's connection to be live: a call before it fails at once. */
function live(): Promise<void> {
  return new Promise((resolve) => {
    const look = () => (connection()?.status() === "live" ? resolve() : setTimeout(look, 50));
    look();
  });
}

void boot().then(async () => {
  const shell = appHost();
  mount(() => (
    <>
      <Root host={shell} />
      <If when={made()}>
        <Disk />
      </If>
    </>
  ));
  await live();
  await write("# Check\n\nThe first text.\n");
  made.set(true);
  redirect(parseRoute(`/r/${repo}/buffer/${path}`));
});
