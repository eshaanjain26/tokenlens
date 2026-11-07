import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: 'tests',
  timeout: 90000,
  reporter: [['list']],
  workers: 1,
  use: {
    baseURL: process.env.BASE_URL || 'http://localhost:4173',
    viewport: { width: 1440, height: 900 },
  },
});
