import { JayZ } from "@ginger.io/jay-z"
import { DynamoDB } from "aws-sdk"
import * as LocalDynamo from "dynamodb-local"
import { Beyonce } from "../../main/dynamo/Beyonce"
import { table } from "./models"

beforeAll(async () => LocalDynamo.launch(dynamoDBPort))
afterAll(async () => LocalDynamo.stop(dynamoDBPort))

export const dynamoDBPort = 9000

export async function setup(jayz?: JayZ): Promise<Beyonce> {
  const { tableName } = table
  const client = new DynamoDB({
    endpoint: `http://localhost:${dynamoDBPort}`,
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
