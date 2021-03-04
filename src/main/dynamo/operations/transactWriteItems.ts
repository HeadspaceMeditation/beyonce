import { DynamoDB } from "aws-sdk"
import { PartitionAndSortKey } from "../keys"
import { TaggedModel } from "../types"
import { MaybeEncryptedItem } from "../util"
import { BaseParams } from "./BaseParams"

export interface TransactWriteItemParams<T extends TaggedModel> extends BaseParams {
  putItems?: MaybeEncryptedItem<T>[]
  deleteItems?: PartitionAndSortKey<T>[]
}

export async function transactWriteItems<T extends TaggedModel>(params: TransactWriteItemParams<T>): Promise<void> {
  const { table, client, putItems = [], deleteItems = [] } = params
  const requests: DynamoDB.DocumentClient.TransactWriteItem[] = []
  putItems.forEach((item) => {
    requests.push({
      Put: {
        TableName: table.tableName,
        Item: item
      }
    })
  })

  deleteItems.forEach((key) =>
    requests.push({
      Delete: {
        TableName: table.tableName,
        Key: {
          [table.partitionKeyName]: key.partitionKey,
          [table.sortKeyName]: key.sortKey
        }
      }
    })
  )

  await client.transactWrite({ TransactItems: requests }).promise()
}
