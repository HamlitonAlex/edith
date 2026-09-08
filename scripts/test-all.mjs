import { spawnSync } from "node:child_process";

const checks = [
  [
    "--test",
    "packages/event-schema/test/event-schema.test.js",
    "packages/event-schema/test/examples.test.js",
    "apps/web/test/plan-state.test.js",
    "apps/web/test/capture-response.test.js",
    "apps/web/test/plan-generator.test.js",
    "apps/web/test/companion-state.test.js",
  ],
  ["scripts/test-server.mjs"],
  ["--check", "apps/web/app.js"],
  ["--check", "apps/web/planner.js"],
  ["--check", "apps/web/companion.js"],
];

for (const argumentsList of checks) {
  const result = spawnSync(process.execPath, argumentsList, {
    cwd: process.cwd(),
    encoding: "utf8",
  });
  process.stdout.write(result.stdout || "");
  process.stderr.write(result.stderr || "");
  if (result.status !== 0) process.exit(result.status || 1);
}

console.log("all milestone checks passed");
