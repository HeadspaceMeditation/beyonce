import { DynamoDB } from "aws-sdk"
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

  const response = client.transactWrite({ TransactItems: requests, ClientRequestToken: clientRequestToken })

  // If a transaction is cancelled (i.e. fails), the AWS sdk sticks the reasons in the response
  // body, but not the exception. So when errors occur, we extract the reasons (if present)
  //  See: https://github.com/aws/aws-sdk-js/issues/2464#issuecomment-503524701
  let transactionCancellationReasons: any[] | undefined
  response.on("extractError", ({ error, httpResponse }) => {
    try {
      if (error) {
        const { CancellationReasons } = JSON.parse(httpResponse.body.toString())
        if (CancellationReasons) {
          transactionCancellationReasons = CancellationReasons
        }
      }
    } catch (e) {} // no op
  })

  try {
    await response.promise()
  } catch (e) {
    if (transactionCancellationReasons) {
      throw new Error(`${e.message}. Cancellation Reasons: ${JSON.stringify(transactionCancellationReasons)}`)
    } else {
      throw e
    }
  }
}
