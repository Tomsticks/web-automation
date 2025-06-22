
import { AutomationConfig } from './types';

export const defaultConfig: AutomationConfig = {
  url: 'https://www.jumia.com.ng/',
  email: 'miracleolaniyan@yahoo.com',
  timeout: 60000,
  retryAttempts: 3,
  scrollDelay: 1500,
  diagnosticMode: true

};

export const productionConfig: AutomationConfig = {
  url: '',
  email: '',
  timeout: 60000,
  retryAttempts: 5,
  scrollDelay: 2000,
  diagnosticMode: false
};

export function createConfig(overrides: Partial<AutomationConfig>): AutomationConfig {
  return { ...defaultConfig, ...overrides };
}
