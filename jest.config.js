const { pathsToModuleNameMapper } = require("ts-jest/utils")
const { compilerOptions } = require("./tsconfig")

module.exports = {
  roots: ["<rootDir>/src"],
  transform: {
    "^.+\\.tsx?$": "ts-jest"
  },

  /** Import all of our tsconfig path mappings to Jest so it doesn't fail on imports */
  moduleNameMapper: pathsToModuleNameMapper(compilerOptions.paths, {
    prefix: "<rootDir>/src/"
  })
}
