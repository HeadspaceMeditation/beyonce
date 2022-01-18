import { TransactWriteCommand, TransactWriteCommandInput } from "@aws-sdk/lib-dynamodb"
import { v4 as generateUUID } from "uuid"
import { PartitionAndSortKey } from "../keys"
import { TaggedModel } from "../types"
import { MaybeEncryptedItem } from "../util"
import { BaseParams } from "./BaseParams"

export interface TransactWriteItemParams<T extends TaggedModel> extends BaseParams {
  clientRequestToken?: string
  putItems?: MaybeEncryptedItem<T>[]
  deleteItems?: PartitionAndSortKey<T>[]
}

export async function transactWriteItems<T extends TaggedModel>(params: TransactWriteItemParams<T>): Promise<void> {
  const { table, client, clientRequestToken = generateUUID(), putItems = [], deleteItems = [] } = params
  const requests: TransactWriteCommandInput["TransactItems"] = []
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

  await client.send(new TransactWriteCommand({ TransactItems: requests, ClientRequestToken: clientRequestToken }))
}
