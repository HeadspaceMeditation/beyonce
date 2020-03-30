const { pathsToModuleNameMapper } = require("ts-jest/utils")
const { compilerOptions } = require("./tsconfig")

module.exports = {
  roots: ["<rootDir>/src"],
  testTimeout: 10000,
  transform: {
    "^.+\\.tsx?$": "ts-jest"
  }
}
