import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb"
import { Table } from "../Table"

export interface BaseParams {
  table: Table<string, string>
  client: DynamoDBDocumentClient
}
