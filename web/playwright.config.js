// End-to-end tests: Playwright starts the production build (vite preview), opens it in a real
// headless Chromium, clicks around like a user would, and checks what happened.
import { defineConfig, devices } from '@playwright/test';

const gpuFlags = {
  // CI machines have no GPU: render WebGL in software (SwiftShader) instead.
  launchOptions: { args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] },
};

export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: 'http://localhost:4173/',
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'npx vite preview --port 4173 --strictPort',
    url: 'http://localhost:4173/',
    reuseExistingServer: !process.env.CI,
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], ...gpuFlags } },
    { name: 'mobile', use: { ...devices['Pixel 7'], ...gpuFlags } },
  ],
});
