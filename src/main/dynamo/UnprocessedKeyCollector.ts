import { DynamoDB } from "aws-sdk"
import { PartitionAndSortKey } from "./keys"
import { Table } from "./Table"
import { TaggedModel } from "./types"

/** Collects a set of unprocessed DynamoDB keys returned from an operation (e.g. batchGet) and maps the "raw"
 *  key Dynamo returns back to the Beyonce key (PartitionAndSortKey class instance)
 *  that the caller originally passed in.
 *
 *  This makes it easy for the caller to re-submit the operation (e.g. batchGet) by directly
 *  passing the keys returned by Beyonce
 */
export class UnprocessedKeyCollector<T extends PartitionAndSortKey<TaggedModel>> {
  private dynamoKeyToBeyonceKey: { [key: string]: T } = {}
  private unprocessedKeys: T[] = []

  constructor(private table: Table<string, string>, inputKeys: T[]) {
    inputKeys.forEach((key) => (this.dynamoKeyToBeyonceKey[`${key.partitionKey}-${key.sortKey}`] = key))
  }

  add(unprocessedKey: DynamoDB.DocumentClient.Key): void {
    const { partitionKeyName, sortKeyName } = this.table
    const beyonceKey = this.dynamoKeyToBeyonceKey[`${unprocessedKey[partitionKeyName]}-${unprocessedKey[sortKeyName]}`]
    if (beyonceKey) {
      this.unprocessedKeys.push(beyonceKey)
    } else {
      throw new Error(
        `UnprocessedKeysCollector: you tried to add an unprocessed key: ${unprocessedKey} that was not included in the input key set`
      )
    }
  }

  getUnprocessedKeys(): T[] {
    return this.unprocessedKeys
  }
}
