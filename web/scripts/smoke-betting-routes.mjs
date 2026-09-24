import { spawn } from "node:child_process";

const port = 3397;
const base = `http://127.0.0.1:${port}`;
const routes = [
  ["/betting", "Upcoming matches under the microscope"],
  ["/betting/results", "What we said. When we said it."],
  ["/betting/tools", "Know the price. Know the risk."],
  ["/betting/my-bets", "Your bets become evidence."],
];
// Launch Next directly rather than via npm, so SIGTERM also ends the server.
const server = spawn(
  process.execPath,
  ["node_modules/next/dist/bin/next", "start", "-p", String(port)],
  {
    stdio: ["ignore", "pipe", "pipe"],
    env: { ...process.env, NEXT_TELEMETRY_DISABLED: "1" },
  },
);
server.stdout.on("data", (data) => process.stdout.write(data));
server.stderr.on("data", (data) => process.stderr.write(data));

async function run() {
  let ready = false;
  for (let i = 0; i < 50; i += 1) {
    if (server.exitCode != null) break;
    try {
      const response = await fetch(base + "/", { signal: AbortSignal.timeout(2000) });
      if (response.ok) {
        ready = true;
        break;
      }
    } catch {
      // Wait until the Next server accepts requests.
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  if (!ready) throw new Error("Next server did not become healthy.");

  const readinessResponse = await fetch(base + "/betting/api/readiness", {
    signal: AbortSignal.timeout(15000),
  });
  const readiness = await readinessResponse.json();
  if (
    !["ready", "missing_configuration", "database_unavailable", "no_forward_model", "no_verified_price", "models_ahead_of_price_window", "no_approved_market"].includes(readiness.state) ||
    typeof readiness.forwardModelledFixtures !== "number" ||
    typeof readiness.freshPricedModelledFixtures !== "number" ||
    typeof readiness.approvedPricedFixtures !== "number" ||
    typeof readiness.nearTermModelledFixtures !== "number" ||
    typeof readiness.nearTermPricedFixturesWithoutModel !== "number" ||
    readiness.modelVersion !== "v7-r16-p50-v20" ||
    ![200, 503].includes(readinessResponse.status)
  ) {
    throw new Error("Readiness probe did not return a valid fail-closed diagnostic.");
  }
  if ((readiness.state === "ready") !== (readinessResponse.status === 200)) {
    throw new Error("Readiness HTTP status disagrees with diagnostic state.");
  }
  console.log(`PASS /betting/api/readiness: ${readiness.state}, ${readiness.forwardModelledFixtures} forward fixtures`);

  for (const [path, expected] of routes) {
    const response = await fetch(base + path, {
      signal: AbortSignal.timeout(45000),
      headers: { Accept: "text/html" },
    });
    const html = await response.text();
    if (response.status !== 200 || !html.includes(expected)) {
      throw new Error(
        `${path} failed: status ${response.status}, expected ${JSON.stringify(expected)}, received ${html.slice(0, 150)}`,
      );
    }
    if (html.includes("Application error: a server-side exception")) {
      throw new Error(`${path} rendered a server-side application error.`);
    }
    console.log(`PASS ${path}: HTTP 200 with expected product content`);
  }
}

try {
  await run();
} finally {
  if (server.exitCode === null && server.signalCode === null) {
    server.kill("SIGTERM");
  }
  server.stdout.destroy();
  server.stderr.destroy();
}
