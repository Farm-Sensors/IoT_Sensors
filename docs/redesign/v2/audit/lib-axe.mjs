import { createRequire } from 'node:module';
const require = createRequire('/Users/jp-dlg/Documents/workspace/personal/riego/IoT_Sensors/frontend/');
export const { chromium } = require('@playwright/test');
const { AxeBuilder } = require('@axe-core/playwright');
export const createRequireAxe = (page) => new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
