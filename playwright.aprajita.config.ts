import {defineConfig} from '@playwright/test';
export default defineConfig({testDir:'./tests',testMatch:'aprajita-browser.spec.ts',workers:1,retries:0,reporter:'list',use:{headless:true,trace:'off',screenshot:'off',video:'off'}});
