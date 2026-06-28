/**
 * STS-DAMS Backend Jest 配置
 * 运行：npx jest --config jest.config.js
 */
module.exports = {
  testEnvironment: 'node',
  roots: ['<rootDir>/tests'],
  testMatch: ['**/*.test.js'],
  setupFiles: [],
  verbose: true,
  forceExit: true,
  clearMocks: true,
  testTimeout: 15000,
};
