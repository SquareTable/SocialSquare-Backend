module.exports = {
    setupFilesAfterEnv: ["<rootDir>/tests/setEnvVars.js", "jest-extended/all"],
    testTimeout: 20_000
};