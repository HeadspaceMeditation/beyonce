import { JayZ } from "@ginger.io/jay-z"
import { DynamoDB } from "aws-sdk"
import { Beyonce } from "../../main/dynamo/Beyonce"
import { table } from "./models"

export const port = 8000
const isRunningOnCI = process.env.CI_BUILD_ID !== undefined
// When running in the CI env, we run Dynamo in a Docker container. And the host must match the service name defined in codeship-services.yml
// see https://documentation.codeship.com/pro/builds-and-configuration/services/#container-networking
const endpoint = isRunningOnCI
  ? `http://dynamodb:${port}`
  : `http://localhost:${port}`

export async function setup(jayz?: JayZ): Promise<Beyonce> {
  const { tableName } = table
  const client = new DynamoDB({
    endpoint,
    region: "us-west-2", // silly, but still need to specify region for LocalDynamo
  })

  // DynamoDB Local runs as an external http server, so we need to clear
  // the table from previous test runs

  const { TableNames: tables } = await client.listTables().promise()
  if (tables !== undefined && tables.indexOf(tableName) !== -1) {
    await client.deleteTable({ TableName: tableName }).promise()
  }

  await client
    .createTable(table.asCreateTableInput("PAY_PER_REQUEST"))
    .promise()

  return new Beyonce(table, client, { jayz })
}
