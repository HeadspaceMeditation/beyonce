import { PartitionAndSortKey } from "../keys"
import { TaggedModel } from "../types"
import { BaseParams } from "./BaseParams"

export interface DeleteItemParams<T extends TaggedModel> extends BaseParams {
  key: PartitionAndSortKey<T>
}

export async function deleteItem<T extends TaggedModel>(params: DeleteItemParams<T>): Promise<void> {
  const { table, client, key } = params
  await client
    .delete({
      TableName: table.tableName,
      Key: {
        [table.partitionKeyName]: key.partitionKey,
        [table.sortKeyName]: key.sortKey
      }
    })
    .promise()
}
