import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import puppeteer from "puppeteer-core";

const port = 3398;
const base = `http://127.0.0.1:${port}`;
const chrome = [
  process.env.CHROME_BIN,
  "/usr/bin/google-chrome",
  "/usr/bin/google-chrome-stable",
  "/usr/bin/chromium",
  "/usr/bin/chromium-browser",
].find((candidate) => candidate && existsSync(candidate));
if (!chrome) throw new Error("Chromium/Chrome is required for the betting user-journey smoke.");

const server = spawn(
  process.execPath,
  ["node_modules/next/dist/bin/next", "start", "-p", String(port)],
  { stdio: ["ignore", "pipe", "pipe"], env: { ...process.env, NEXT_TELEMETRY_DISABLED: "1" } },
);
server.stdout.on("data", (data) => process.stdout.write(data));
server.stderr.on("data", (data) => process.stderr.write(data));

let browser;
try {
  let ready = false;
  for (let i = 0; i < 50; i += 1) {
    if (server.exitCode != null) break;
    try {
      const response = await fetch(base + "/betting", { signal: AbortSignal.timeout(3000) });
      if (response.ok) { ready = true; break; }
    } catch {
      // Poll readiness until the built server accepts connections.
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  if (!ready) throw new Error("Built betting app did not become ready.");

  browser = await puppeteer.launch({
    headless: true,
    executablePath: chrome,
    args: ["--no-sandbox", "--disable-dev-shm-usage", "--disable-gpu"],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
  const clientErrors = [];
  page.on("pageerror", (error) => clientErrors.push(error.message));

  await page.goto(base + "/betting", { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForSelector(".age-gate-card button", { timeout: 15000 });
  await page.click(".age-gate-card button");
  await page.waitForFunction(() => !document.querySelector(".age-gate-backdrop"), { timeout: 10000 });
  await page.waitForSelector('nav.betting-mobile-dock a[href="/betting/tools"]', { visible: true });
  const today = await page.$eval("body", (body) => body.innerText);
  if (!today.includes("Actual Footy probabilities, not just a fixture list")) {
    throw new Error("Today did not render its model research/coverage state.");
  }
  console.log("PASS mobile Today and age confirmation");

  await page.click('nav.betting-mobile-dock a[href="/betting/tools"]');
  await page.waitForFunction(
    () => location.pathname === "/betting/tools" && document.body.innerText.includes("Know the price. Know the risk."),
    { timeout: 15000 },
  );
  const stake = ".lab-panel-primary .money-input input";
  await page.waitForSelector(stake);
  await page.click(stake, { clickCount: 3 });
  await page.keyboard.press("Backspace");
  await page.type(stake, "20");
  await page.waitForFunction(
    () => document.querySelector(".lab-metric-grid")?.textContent?.includes("£50"),
    { timeout: 5000 },
  );
  console.log("PASS mobile Bet Lab and reactive stake calculator");

  await page.click('nav.betting-mobile-dock a[href="/betting/results"]');
  await page.waitForFunction(
    () => location.pathname === "/betting/results" && document.body.innerText.includes("What we said. When we said it."),
    { timeout: 15000 },
  );
  console.log("PASS mobile Results navigation");

  await page.click('nav.betting-mobile-dock a[href="/betting/my-bets"]');
  await page.waitForFunction(
    () => location.pathname === "/betting/my-bets" && document.body.innerText.includes("Your bets become evidence."),
    { timeout: 15000 },
  );
  console.log("PASS mobile My Bets navigation");

  if (clientErrors.length) throw new Error("Browser page errors: " + clientErrors.join(" | "));
  console.log("PASS no uncaught browser errors");
} finally {
  await browser?.close();
  if (server.exitCode === null && server.signalCode === null) server.kill("SIGTERM");
  server.stdout.destroy();
  server.stderr.destroy();
}
