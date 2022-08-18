import { TransactWriteCommand } from "@aws-sdk/lib-dynamodb"
import { TransactWriteItem } from "@aws-sdk/client-dynamodb"
import { v4 as generateUUID } from "uuid"
import { PartitionAndSortKey } from "../keys"
import { TaggedModel } from "../types"
import { MaybeEncryptedItem } from "../util"
import { BaseParams } from "./BaseParams"

export interface TransactWriteItemParams<T extends TaggedModel> extends BaseParams {
  clientRequestToken?: string
  putItems?: { item: MaybeEncryptedItem<T>; failIfNotUnique?: boolean }[]
  deleteItems?: PartitionAndSortKey<T>[]
}

export async function transactWriteItems<T extends TaggedModel>(params: TransactWriteItemParams<T>): Promise<void> {
  const { table, client, clientRequestToken = generateUUID(), putItems = [], deleteItems = [] } = params
  const requests: TransactWriteItem[] = []
  putItems.forEach(({ item, failIfNotUnique = false }) => {
    requests.push({
      Put: {
        TableName: table.tableName,
        Item: item,
        // DynamoDB evaluates the ConditionExpression against a record with the same partition key
        // (and sort key if applicable) of the `item` provided here. If no existing record matches the pk and sk of the
        // provided `item`, `attribute_not_exists` will evaluate to true. However, if an existing record matches the pk
        // and sk of the given `item`, attribute_not_exists(pk) will evaluate to false because every record has a pk.
        // In that case, the transaction will be cancelled due to the failing ConditionExpression.
        ConditionExpression: failIfNotUnique ? "attribute_not_exists(pk)" : undefined
      }
    })
  })

  deleteItems.forEach((key) =>
    requests.push({
      Delete: {
        TableName: table.tableName,
        // @ts-ignore The type is incorrect for `Key`. It expects Record<string, AttributeValue>, but since we're using
        //  a DynamoDBDocumentClient, it needs to be Record<string, string> instead.
        Key: {
          [table.partitionKeyName]: key.partitionKey,
          [table.sortKeyName]: key.sortKey
        }
      }
    })
  )

  const response = client.send(new TransactWriteCommand({ TransactItems: requests, ClientRequestToken: clientRequestToken }))

  try {
    await response
  } catch (e) {
    if (e && e.CancellationReasons) {
      throw new Error(`${e.message}. Cancellation Reasons: ${JSON.stringify(e.CancellationReasons)}`)
    }

    throw e
  }
}
