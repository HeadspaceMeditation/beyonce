import { PartitionKey } from "./keys"
import { Model } from "./Model"
import { ExtractFields } from "./types"

export class Partition<
  T extends Model<any, any, any>,
  U extends Model<any, any, any>
> {
  constructor(private models: [T, ...U[]]) {}

  /** Since we assume that all this.models[] live under the same partition
   *  we can generate a valid partition key by calling models[0].partitionKey
   * (or any models[i].key - but models[0] is convenient)
   */
  key(
    params: Parameters<T["partitionKey"]>[0]
  ): PartitionKey<ExtractFields<T | U>> {
    const { partitionKeyName, partitionKey } = this.models[0].partitionKey(
      params
    )
    return new PartitionKey<ExtractFields<T | U>>(
      partitionKeyName,
      partitionKey
    )
  }
}
