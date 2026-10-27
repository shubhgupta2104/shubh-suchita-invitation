import { defineConfig } from "@playwright/test";

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
    viewport: { width: 390, height: 844 },
    trace: "retain-on-failure"
  },
  webServer: {
    command: "PORT=4197 node server.mjs",
    url: "http://127.0.0.1:4197",
    reuseExistingServer: false
  }
});
