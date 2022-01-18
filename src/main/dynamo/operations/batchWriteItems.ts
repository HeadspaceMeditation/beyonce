import { BatchWriteCommand, BatchWriteCommandInput } from "@aws-sdk/lib-dynamodb"
import { PartitionAndSortKey } from "../keys"
import { TaggedModel } from "../types"
import { UnprocessedKeyCollector } from "../UnprocessedKeyCollector"
import { MaybeEncryptedItem } from "../util"
import { BaseParams } from "./BaseParams"

export interface BatchWriteItemParams<T extends TaggedModel> extends BaseParams {
  putItems?: MaybeEncryptedItem<T>[]
  deleteItems?: PartitionAndSortKey<T>[]
}

export interface BatchWriteItemResult<T extends TaggedModel> {
  unprocessedPuts: T[]
  unprocessedDeletes: PartitionAndSortKey<T>[]
}

export async function batchWriteItems<T extends TaggedModel>(
  params: BatchWriteItemParams<T>
): Promise<BatchWriteItemResult<T>> {
  const { table, client, putItems = [], deleteItems = [] } = params
  const { tableName, partitionKeyName, sortKeyName } = table
  const requests: BatchWriteCommandInput["RequestItems"] = { [tableName]: [] }

  putItems.forEach((item) => {
    requests[tableName].push({ PutRequest: { Item: item } })
  })

  deleteItems.forEach((key) => {
    requests[tableName].push({
      DeleteRequest: {
        Key: {
          [partitionKeyName]: key.partitionKey,
          [sortKeyName]: key.sortKey
        }
      }
    })
  })

  const results = await client.send(new BatchWriteCommand({ RequestItems: requests }))
  const unprocessedPuts: T[] = []
  const unprocessedDeleteKeys = new UnprocessedKeyCollector(table, deleteItems)

  if (results.UnprocessedItems && results.UnprocessedItems[tableName]) {
    results.UnprocessedItems[tableName].forEach(({ PutRequest, DeleteRequest }) => {
      if (PutRequest) {
        unprocessedPuts.push(PutRequest.Item as T)
      } else if (DeleteRequest && DeleteRequest.Key) {
        unprocessedDeleteKeys.add(DeleteRequest.Key)
      }
    })
  }

  return { unprocessedPuts, unprocessedDeletes: unprocessedDeleteKeys.getUnprocessedKeys() }
}
