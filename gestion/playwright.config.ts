import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./e2e",
  workers: 1,
  timeout: 45000,
  use: {
    baseURL: process.env.GESTION_E2E_BASE_URL || "http://127.0.0.1:5181",
    viewport: { width: 1440, height: 1100 },
    channel: "msedge",
    screenshot: "only-on-failure",
  },
  webServer: process.env.GESTION_E2E_BASE_URL ? undefined : {
    command: "npm run dev -- --port 5181 --strictPort",
    url: "http://127.0.0.1:5181",
    reuseExistingServer: true,
  },
  reporter: "list",
});
