module.exports = {
  testEnvironment: 'node',
  preset: 'ts-jest',
  transform: {
    '^.+\\.ts$': ['ts-jest', { isolatedModules: true }]
  }
};
