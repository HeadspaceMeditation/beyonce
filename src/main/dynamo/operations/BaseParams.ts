import { DynamoDB } from "aws-sdk"
import { Table } from "../Table"

export interface BaseParams {
  table: Table<string, string>
  client: DynamoDB.DocumentClient
}
