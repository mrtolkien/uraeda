// What a VM starts, and must not leave behind: a child process, started as it loads, a timer
// that writes a file, and two calls that never return.
import type { ServerApi } from "uraeda/server";
import * as fs from "uraeda:fs";
import { run, spawn } from "uraeda:process";

export default function activate(api: ServerApi) {
  const child = spawn("sleep", ["1000"]);
  api.record("child", () => ({ pid: child.pid, version: 1 }));
  api.action("tick", (input: { file: string }) => {
    setInterval(() => fs.appendText(input.file, "tick\n"), 20);
    return null;
  });
  api.action("spin", () => {
    for (;;) {
      // Never returns.
    }
  });
  api.action("never", () => new Promise(() => {}));
  api.action("probe", async (input: { folder: string; url: string }) => {
    const file = fs.join(input.folder, "notes", "one.txt");
    fs.makeFolder(fs.parent(file));
    fs.writeText(file, "written");
    fs.appendText(file, " twice");
    const said = await run("sh", ["-c", "echo one; echo; echo two >&2; exit 3"]);
    const answer = await fetch(input.url, { headers: { accept: "text/plain" } });
    return {
      code: said.code,
      listed: fs.list(fs.parent(file)),
      lines: said.lines,
      missing: (await run("no-such-command-of-uraeda")).missing,
      name: fs.name(file),
      relative: fs.relative(input.folder, file),
      size: fs.stat(file)?.size ?? null,
      status: answer.status,
      stderr: said.stderr,
      text: fs.readText(file),
    };
  });
}
