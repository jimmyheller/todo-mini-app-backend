/** @type {import('@jest/types').Config.InitialOptions} */
module.exports = {
    preset: 'ts-jest',
    testEnvironment: 'node',
    roots: ['<rootDir>/src'],
    testMatch: ['**/src/**/__tests__/**/*.test.ts'],
    verbose: true,
    forceExit: true,
    testTimeout: 10000,
    maxWorkers: 1,
    transform: {
        '^.+\\.tsx?$': ['ts-jest', {
            tsconfig: './tsconfig.json'
        }]
    },
    reporters: [
        "default",
        "summary"
    ],
    verbose: false // Set to false to get cleaner output
};