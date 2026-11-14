import { defineConfig } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const needsNativeChrome = process.platform === "darwin" && process.arch === "x64" &&
  execFileSync("/usr/sbin/sysctl", ["-n", "hw.optional.arm64"], { encoding: "utf8" }).trim() === "1";

export default defineConfig({
  testDir: "./tests",
  testMatch: "**/*.spec.js",
  fullyParallel: false,
  workers: 1,
  reporter: "list",
  use: {
    baseURL: "http://127.0.0.1:4197",
    browserName: "chromium",
    channel: "chrome",
    launchOptions: needsNativeChrome ? {
      executablePath: fileURLToPath(new URL("./tools/chrome-arm64.sh", import.meta.url))
    } : {},
    viewport: { width: 390, height: 844 },
    trace: "retain-on-failure"
  },
  webServer: {
    command: "PORT=4197 node server.mjs",
    url: "http://127.0.0.1:4197",
    reuseExistingServer: false
  }
});
