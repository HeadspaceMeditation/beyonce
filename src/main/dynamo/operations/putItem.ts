import { TaggedModel } from "../types"
import { MaybeItem } from "../util"
import { BaseParams } from "./BaseParams"

export interface PutItemParams<T extends TaggedModel> extends BaseParams {
  item: MaybeItem<T>
}

export async function putItem<T extends TaggedModel>(params: PutItemParams<T>): Promise<void> {
  const { table, client, item } = params
  await client
    .put({
      TableName: table.tableName,
      Item: item
    })
    .promise()
}
