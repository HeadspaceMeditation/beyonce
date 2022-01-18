import { BatchGetCommand, DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb"
import { NativeAttributeValue } from "@aws-sdk/util-dynamodb"
import { PartitionAndSortKey } from "../keys"
import { Table } from "../Table"
import { TaggedModel } from "../types"
import { UnprocessedKeyCollector } from "../UnprocessedKeyCollector"
import { BaseParams } from "./BaseParams"

export interface BatchGetItemsParams<T extends PartitionAndSortKey<TaggedModel>> extends BaseParams {
  table: Table<string, string>
  client: DynamoDBDocumentClient
  keys: T[]
  consistentRead?: boolean
}

export interface BatchGetItemsResult<T extends PartitionAndSortKey<TaggedModel>> {
  items: { [key: string]: NativeAttributeValue }[]
  unprocessedKeys: T[]
}

/** Performs a "raw" batchGet operation in Dynamo */
export async function batchGetItems<T extends PartitionAndSortKey<TaggedModel>>(
  params: BatchGetItemsParams<T>
): Promise<BatchGetItemsResult<T>> {
  const { table, client, consistentRead } = params
  const { tableName } = table
  const results = await client.send(
    new BatchGetCommand({
      RequestItems: {
        [tableName]: {
          ConsistentRead: consistentRead,
          Keys: mapToKeysAndRemoveDuplicate(params.keys, table)
        }
      }
    })
  )

  const unprocessedKeys = new UnprocessedKeyCollector(table, params.keys)
  if (results.UnprocessedKeys && results.UnprocessedKeys[tableName]) {
    results.UnprocessedKeys[tableName].Keys?.forEach((key) => unprocessedKeys.add(key))
  }

  if (results.Responses && results.Responses[tableName]) {
    return { items: results.Responses[tableName], unprocessedKeys: unprocessedKeys.getUnprocessedKeys() }
  } else {
    return { items: [], unprocessedKeys: [] }
  }
}

function mapToKeysAndRemoveDuplicate<T extends PartitionAndSortKey<TaggedModel>>(
  keys: T[],
  table: Table
): Array<Record<string, string>> {
  const dynamoKeyMap: Record<string, boolean> = {}
  const uniqueKeys: Array<Record<string, string>> = []
  const { partitionKeyName, sortKeyName } = table
  keys.forEach(({ partitionKey, sortKey }) => {
    if (!dynamoKeyMap[`${partitionKey}-${sortKey}`]) {
      dynamoKeyMap[`${partitionKey}-${sortKey}`] = true
      uniqueKeys.push({
        [partitionKeyName]: partitionKey,
        [sortKeyName]: sortKey
      })
    }
  })
  return uniqueKeys
}
