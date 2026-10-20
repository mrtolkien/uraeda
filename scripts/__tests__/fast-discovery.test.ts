import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { expect, test } from "vite-plus/test";

const root = fileURLToPath(new URL("../..", import.meta.url));
const setup = `
import {createVitest} from "vite-plus/test/node";
import {fastConfig} from "./vite.fast.config.ts";
import {families,selectFast} from "./scripts/fast-selection.ts";
process.env.VITEST="true";
`;
function execute(code: string) {
  return spawnSync(process.execPath, ["--input-type=module", "-e", setup + code], {
    cwd: root,
    encoding: "utf8",
    timeout: 30_000,
  });
}

test("focused UI discovery and execution exclude the application and native graph", () => {
  const result = execute(`
const config=fastConfig(selectFast([{path:"packages/web/src/ComposerImages.tsx",deleted:false}]));
const vitest=await createVitest({config:false,related:config.related,watch:false},{test:config.test});
try {
  await vitest.standalone();
  const specs=await vitest.getRelevantTestSpecifications();
  const graph=vitest.projects.flatMap(project=>[...project.vite.moduleGraph.idToModuleMap.keys()]);
  if (graph.some(path=>/App\\.tsx|createApp|server[\\/](?:src[\\/])?(?:testing|app)|binding[\\/]index\\.js|\\.node$/.test(path))) throw new Error("application/native dependency");
  if (specs.length!==1 || !specs[0].moduleId.endsWith("composer-images.test.tsx")) throw new Error("wrong focused selection");
  const result=await vitest.runTestSpecifications(specs);
  if (result.unhandledErrors.length || result.testModules.some(module=>!module.ok())) process.exitCode=1;
} finally { await vitest.close(); }
`);
  expect(result.status, result.stdout + result.stderr).toBe(0);
});

test("a discovery transform error exits nonzero and closes the runner", () => {
  const result = execute(`
const config=fastConfig(selectFast([{path:"packages/web/src/drop.ts",deleted:false}]));
const project=config.test.projects[0];
project.plugins.push({name:"broken-discovery",transform(_code,id){if(id.endsWith("drop.test.ts")) throw new Error("discovery fault");}});
const vitest=await createVitest({config:false,related:config.related,watch:false},{test:config.test});
try {await vitest.standalone(); await vitest.getRelevantTestSpecifications();}
finally {await vitest.close(); process.stderr.write("runner closed\\n");}
`);
  expect(result.status).not.toBe(0);
  expect(result.stderr).toContain("discovery fault");
  expect(result.stderr).toContain("runner closed");
});

test("a required family with no test files fails before discovery", () => {
  const result = execute(`
families.ui.tests=["missing.test.ts"];
fastConfig(selectFast([{path:"packages/web/src/deleted.ts",deleted:true}]));
`);
  expect(result.status).not.toBe(0);
  expect(result.stderr).toContain("Selected family ui has no test files");
});
