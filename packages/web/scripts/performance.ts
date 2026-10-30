/**
 * `vp run performance [--no-build]`: the benchmark of the performance decision, run on demand and
 * never by `ready` (R7). It builds the binding in release and the web UI, as `vp run start` does,
 * unless `--no-build`; seeds the sandbox's projects into a temporary folder, with a clone of this
 * checkout, Uraeda's own 69 features; serves them with `main.ts`; and drives Chromium with
 * Playwright, at a desktop's size, over the realistic project, then over the clone.
 *
 * It times each success criterion of the performance pass: pages by click and by key (SC-001),
 * reloads (SC-002), writes from their press (SC-003), Start to its session (SC-004), a commit made
 * outside to its page (SC-005), and pages once a start made its worktree (SC-006). Each time is
 * printed against its target, 100 ms or 1 second, with the `Server-Timing` of the requests it
 * waited on, and the run exits 1 past any target.
 */
import { fileURLToPath } from "node:url";
import { type Browser, chromium } from "playwright";
import { clickColumn, keyPages, reloads, visited } from "./performance-pages.ts";
import { installProbe, ServerTimes } from "./performance-probe.ts";
import { Report, type Run } from "./performance-report.ts";
import { buildRelease, type Project, serve, signIn } from "./performance-setup.ts";
import { answer, approve, outsideCommit, promote, start } from "./performance-writes.ts";

const root = fileURLToPath(new URL("../../..", import.meta.url));

/** The realistic project's features the writes act on. */
const ROUND = "/f/2026-10-21-leader-key/clarifications-01.md";
const SPEC = "/f/2026-10-19-leader-key/spec.md";
const NOTE = "Dark mode flashes white for a moment when the app opens";

/** The pages by click and key, then the reloads of those clicked, in `project`. */
async function pages(run: Run, { prefix }: Project) {
  visited.clear();
  await run.page.goto(`${prefix}/`);
  await run.page.waitForFunction(() => window.__perf.loaded);
  await clickColumn(run, "SC-001");
  await keyPages(run, prefix);
  await reloads(run, [`${prefix}/`, ...[...visited].slice(0, 9)]);
}

async function main(): Promise<boolean> {
  if (!process.argv.includes("--no-build")) {
    buildRelease(root);
  }
  const served = await serve(root);
  let browser: Browser | undefined;
  try {
    browser = await chromium.launch();
    const context = await browser.newContext({
      baseURL: served.url,
      viewport: { height: 900, width: 1440 },
    });
    const page = await context.newPage();
    await installProbe(page);
    await signIn(page, served.key);
    const report = new Report();
    const server = new ServerTimes(page);
    const { realistic, uraeda } = served.projects;

    const onRealistic: Run = { page, project: "realistic", report, server };
    await pages(onRealistic, realistic);
    await answer(onRealistic, `${realistic.prefix}${ROUND}`);
    await promote(onRealistic, realistic.prefix, NOTE);
    await approve(onRealistic, `${realistic.prefix}${SPEC}`, realistic.folder);
    await outsideCommit(onRealistic, realistic.prefix, realistic.folder, "A note from outside");

    const onUraeda: Run = { page, project: "uraeda", report, server };
    await pages(onUraeda, uraeda);
    await outsideCommit(onUraeda, uraeda.prefix, uraeda.folder, "A note from outside");
    await start(onUraeda, uraeda.prefix, uraeda.folder);
    return report.print();
  } finally {
    await browser?.close();
    served.stop();
  }
}

process.exitCode = (await main()) ? 0 : 1;
