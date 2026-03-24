/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  rootDir: '.',
  testMatch: ['**/tests/**/*.test.ts'],
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    // consumer.ts est l'orchestrateur d'infrastructure (RabbitMQ, HTTP server startup).
    // Il ne peut pas être testé en unité sans un vrai broker RabbitMQ.
    // La logique métier (processTicketConfirmed, getUserInfo) est dans notificationService.ts.
    '!src/consumer.ts',
  ],
  coverageThreshold: {
    global: {
      lines: 90,
      functions: 90,
      branches: 84,
      statements: 90,
    },
  },
  coverageReporters: ['text', 'lcov'],
};
