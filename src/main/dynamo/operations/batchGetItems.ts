import { DynamoDB } from "aws-sdk"
import { PartitionAndSortKey } from "../keys"
import { Table } from "../Table"
import { TaggedModel } from "../types"
import { UnprocessedKeyCollector } from "../UnprocessedKeyCollector"
import { BaseParams } from "./BaseParams"

export interface BatchGetItemsParams<T extends PartitionAndSortKey<TaggedModel>> extends BaseParams {
  table: Table<string, string>
  client: DynamoDB.DocumentClient
  keys: T[]
  consistentRead?: boolean
}

export interface BatchGetItemsResult<T extends PartitionAndSortKey<TaggedModel>> {
  items: DynamoDB.DocumentClient.AttributeMap[]
  unprocessedKeys: T[]
}

/** Performs a "raw" batchGet operation in Dynamo */
export async function batchGetItems<T extends PartitionAndSortKey<TaggedModel>>(
  params: BatchGetItemsParams<T>
): Promise<BatchGetItemsResult<T>> {
  const { table, client, consistentRead } = params
  const { tableName, partitionKeyName, sortKeyName } = table
  const results = await client
    .batchGet({
      RequestItems: {
        [tableName]: {
          ConsistentRead: consistentRead,
          Keys: params.keys.map(({ partitionKey, sortKey }) => ({
            [partitionKeyName]: partitionKey,
            [sortKeyName]: sortKey
          }))
        }
      }
    })
    .promise()

  const unprocessedKeys = new UnprocessedKeyCollector(table, params.keys)
  if (results.UnprocessedKeys && results.UnprocessedKeys[tableName]) {
    results.UnprocessedKeys[tableName].Keys.forEach((key) => unprocessedKeys.add(key))
  }

  if (results.Responses && results.Responses[tableName]) {
    return { items: results.Responses[tableName], unprocessedKeys: unprocessedKeys.getUnprocessedKeys() }
  } else {
    return { items: [], unprocessedKeys: [] }
  }
}
