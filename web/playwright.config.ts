// End-to-end tests against the production build (`next start`), in a real headless Chromium,
// on a desktop and a phone viewport.
import { defineConfig, devices } from "@playwright/test";

const gpu = { launchOptions: { args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] } }; // software WebGL on CI

export default defineConfig({
  testDir: "./e2e",
  timeout: 45_000,
  expect: { timeout: 10_000 },
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  use: { baseURL: "http://localhost:3100", trace: "retain-on-failure", locale: "en-US" },
  webServer: {
    command: "npx next start -p 3100",
    url: "http://localhost:3100/en",
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"], ...gpu } },
    { name: "mobile", use: { ...devices["Pixel 7"], ...gpu } },
  ],
});
