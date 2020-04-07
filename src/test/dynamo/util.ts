import { JayZ } from "@ginger.io/jay-z"
import { DynamoDB } from "aws-sdk"
import * as LocalDynamo from "dynamodb-local"
import { Beyonce } from "../../main/dynamo/Beyonce"
import { Table } from "../../main/dynamo/Table"

beforeAll(async () => LocalDynamo.launch(dynamoDBPort))
afterAll(async () => LocalDynamo.stop(dynamoDBPort))

export const dynamoDBPort = 9000

export async function setup(jayz?: JayZ): Promise<Beyonce> {
  const client = new DynamoDB({
    endpoint: `http://localhost:${dynamoDBPort}`,
    region: "us-west-2", // silly, but still need to specify region for LocalDynamo
  })

  // DynamoDB Local runs as an external http server, so we need to clear
  // the table from previous test runs
  const tableName = "TestTable"

  const table = new Table({
    name: tableName,
    partitionKeyName: "pk",
    sortKeyName: "sk",
  })

  const { TableNames: tables } = await client.listTables().promise()
  if (tables !== undefined && tables.indexOf(tableName) !== -1) {
    await client.deleteTable({ TableName: tableName }).promise()
  }

  await client
    .createTable({
      TableName: tableName,

      KeySchema: [
        { AttributeName: "pk", KeyType: "HASH" },
        { AttributeName: "sk", KeyType: "RANGE" },
      ],

      AttributeDefinitions: [
        { AttributeName: "pk", AttributeType: "S" },
        { AttributeName: "sk", AttributeType: "S" },
        { AttributeName: "model", AttributeType: "S" },
        { AttributeName: "name", AttributeType: "S" },
        { AttributeName: "id", AttributeType: "S" },
      ],

      GlobalSecondaryIndexes: [
        {
          IndexName: "byNameAndId",
          KeySchema: [
            { AttributeName: "name", KeyType: "HASH" },
            { AttributeName: "id", KeyType: "RANGE" },
          ],
          Projection: {
            ProjectionType: "ALL",
          },
        },
        {
          IndexName: "byModelAndId",
          KeySchema: [
            { AttributeName: "model", KeyType: "HASH" },
            { AttributeName: "id", KeyType: "RANGE" },
          ],
          Projection: {
            ProjectionType: "ALL",
          },
        },
      ],

      BillingMode: "PAY_PER_REQUEST",
    })
    .promise()

  const jayzConfig =
    jayz !== undefined
      ? {
          client: jayz,
          encryptionBlacklist: new Set(["pk", "sk", "model", "name", "id"]),
        }
      : undefined

  return new Beyonce(table, client, {
    jayz: jayzConfig,
  })
}
