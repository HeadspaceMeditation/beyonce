module.exports = async () => {
  const isRunningOnCI = process.env.CI_BUILD_ID !== undefined
  const port = 8000

  // When running in the CI env, we run Dynamo in a Docker container. And the host must match the service name defined in codeship-services.yml
  // see https://documentation.codeship.com/pro/builds-and-configuration/services/#container-networking
  const endpoint = isRunningOnCI
    ? `http://dynamodb:${port}`
    : `http://localhost:${port}`

  return {
    port,
    clientConfig: {
      endpoint,
      sslEnabled: false,
      region: "local",
    },
    options: ["-inMemory"],
    tables: [],
  }
}
