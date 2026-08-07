import { type ChildProcess, spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.join(__dirname, "..", "..");

export const PHP_BASE_URL =
  process.env.PHP_BASE_URL ?? "http://127.0.0.1:8010";
export const NODE_BASE_URL =
  process.env.NODE_BASE_URL ?? "http://127.0.0.1:8011";

const children: ChildProcess[] = [];

async function waitUntilReady(url: string, timeoutMs = 10000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      await fetch(url, { redirect: "manual" });
      return;
    } catch {
      await new Promise((r) => setTimeout(r, 150));
    }
  }
  throw new Error(`Server at ${url} did not become ready in time`);
}

export default async function globalSetup() {
  const env = {
    ...process.env,
    DB_HOST: process.env.DB_HOST ?? "127.0.0.1",
    DB_PORT: process.env.DB_PORT ?? "3306",
    DB_USER: process.env.DB_USER ?? "logistic_app",
    DB_PASS: process.env.DB_PASS ?? "user123",
  };

  const phpPort = new URL(PHP_BASE_URL).port;
  const php = spawn("php", ["-S", `127.0.0.1:${phpPort}`], {
    cwd: repoRoot,
    env,
    stdio: "ignore",
  });
  children.push(php);

  const nodePort = new URL(NODE_BASE_URL).port;
  const node = spawn(
    "npx",
    ["tsx", path.join(repoRoot, "src", "server.ts")],
    {
      cwd: repoRoot,
      env: {
        ...env,
        PORT: nodePort,
        SESSION_SECRET:
          process.env.SESSION_SECRET ??
          "test-session-secret-32-chars-minimum",
      },
      stdio: "ignore",
    }
  );
  children.push(node);

  await Promise.all([
    waitUntilReady(`${PHP_BASE_URL}/login.php`),
    waitUntilReady(`${NODE_BASE_URL}/login`),
  ]);

  return async function teardown() {
    for (const child of children) {
      child.kill();
    }
  };
}
