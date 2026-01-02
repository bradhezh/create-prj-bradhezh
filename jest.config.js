module.exports = {
  testEnvironment: "node",
  transform: {
    "^.+\\.[jt]sx?$": ["@swc/jest", { module: { type: "commonjs" } }],
  },
  moduleNameMapper: { "^@/(.*)$": "<rootDir>/src/$1" },
  testTimeout: 5000,
};
