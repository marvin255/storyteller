import config from './jest.config.js';

export default {
  ...config,
  roots: ['<rootDir>/tests/integration'],
  testMatch: [
    '<rootDir>/tests/integration/**/*.test.ts',
    '<rootDir>/tests/integration/**/*.spec.ts',
  ],
  testPathIgnorePatterns: ['/node_modules/'],
  coverageThreshold: undefined,
  testTimeout: 30000,
};
