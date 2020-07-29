module.exports = {
  roots: ["<rootDir>/src"],
  testTimeout: 10000,
  preset: "@shelf/jest-dynamodb",
  transform: {
    "^.+\\.tsx?$": "ts-jest",
  },
}
