import { spawn } from "node:child_process";

const port = 3397;
const base = `http://127.0.0.1:${port}`;
const routes = [
  ["/betting", "Actual Footy probabilities, not just a fixture list"],
  ["/betting/results", "What we said. When we said it."],
  ["/betting/tools", "Know the price. Know the risk."],
  ["/betting/my-bets", "Your bets become evidence."],
];
const server = spawn(
  "npm",
  ["run", "start", "--", "-p", String(port)],
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
  server.kill("SIGTERM");
}
