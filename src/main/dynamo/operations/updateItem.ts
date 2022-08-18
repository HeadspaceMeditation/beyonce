import { UpdateCommand } from "@aws-sdk/lib-dynamodb"
import { DynamoDBExpression } from "../expressions/DynamoDBExpression"
import { PartitionAndSortKey } from "../keys"
import { TaggedModel } from "../types"
import { BaseParams } from "./BaseParams"

export interface UpdateItemParams<T extends TaggedModel> extends BaseParams {
  key: PartitionAndSortKey<T>
  keyConditionExpression: string
  updateExpression: DynamoDBExpression
}

export interface UpdateItemResult<T extends TaggedModel> {
  item: T
}

export async function updateItem<T extends TaggedModel>(params: UpdateItemParams<T>): Promise<UpdateItemResult<T>> {
  const { table, client, key, keyConditionExpression, updateExpression } = params
  const { expression, attributeNames, attributeValues } = updateExpression
  const hasValues = Object.keys(attributeValues).length > 0
  const result = await client
    .send( new UpdateCommand({
      TableName: table.tableName,
      ConditionExpression: keyConditionExpression,
      Key: {
        [table.partitionKeyName]: key.partitionKey,
        [table.sortKeyName]: key.sortKey
      },
      UpdateExpression: expression,
      ExpressionAttributeNames: attributeNames,
      ExpressionAttributeValues: hasValues ? attributeValues : undefined,
      ReturnValues: "ALL_NEW" // return item after update applied
    }))

  if (result.Attributes !== undefined) {
    return { item: result.Attributes as T }
  } else {
    throw new Error(`Item pk: ${key.partitionKey}, sk: ${key.sortKey} not found`)
  }
}
