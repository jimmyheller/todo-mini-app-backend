/** @type {import('@jest/types').Config.InitialOptions} */
module.exports = {
    preset: 'ts-jest',
    testEnvironment: 'node',
    roots: ['<rootDir>/src'],
    testMatch: ['**/src/**/__tests__/**/*.test.ts'],
    testTimeout: 30000,
    verbose: true,
    forceExit: true,
    maxWorkers: 1,
    transform: {
        '^.+\\.tsx?$': ['ts-jest', {
            tsconfig: './tsconfig.json'
        }]
    },
    moduleNameMapper: {
        '^@/(.*)$': '<rootDir>/src/$1',
    }
};