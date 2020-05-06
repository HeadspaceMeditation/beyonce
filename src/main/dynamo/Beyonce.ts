import { JayZ } from "@ginger.io/jay-z"
import { DynamoDB } from "aws-sdk"
import { groupModelsByType } from "./groupModelsByType"
import {
  PartitionAndSortKey,
  PartitionKey,
  PartitionKeyAndSortKeyPrefix,
} from "./keys"
import { QueryBuilder } from "./QueryBuilder"
import { Table } from "./Table"
import { ExtractKeyType, GroupedModels, TaggedModel } from "./types"
import {
  decryptOrPassThroughItem,
  encryptOrPassThroughItems,
  MaybeEncryptedItems,
  toJSON,
} from "./util"
import { ConfigurationOptions } from "aws-sdk/lib/config"

export type Options = {
  jayz?: JayZ
}

export type GetOptions = {
  consistentRead?: boolean
}

export type QueryOptions = {
  consistentRead?: boolean
}

/** A thin wrapper around the DynamoDB sdk client that
 * does auto mapping between JSON <=> DynamoDB Items
 */
export class Beyonce {
  private client: DynamoDB.DocumentClient
  private jayz?: JayZ

  constructor(private table: Table, dynamo: DynamoDB, options: Options = {}) {
    this.client = new DynamoDB.DocumentClient({ service: dynamo })

    if (options.jayz !== undefined) {
      this.jayz = options.jayz
    }
  }

  /** Retrieve a single Item out of Dynamo */
  async get<T extends TaggedModel>(
    key: PartitionAndSortKey<T>,
    options: GetOptions = {}
  ): Promise<T | undefined> {
    const { Item: item } = await this.client
      .get({
        TableName: this.table.tableName,
        ConsistentRead: options.consistentRead,
        Key: {
          [this.table.partitionKeyName]: key.partitionKey,
          [this.table.sortKeyName]: key.sortKey,
        },
      })
      .promise()

    if (item !== undefined) {
      return toJSON<T>(await decryptOrPassThroughItem(this.jayz, item))
    }
  }

  async delete<T extends TaggedModel>(
    key: PartitionAndSortKey<T>
  ): Promise<void> {
    await this.client
      .delete({
        TableName: this.table.tableName,
        Key: {
          [this.table.partitionKeyName]: key.partitionKey,
          [this.table.sortKeyName]: key.sortKey,
        },
      })
      .promise()
  }

  /** BatchGet items */
  async batchGet<T extends PartitionAndSortKey<TaggedModel>>(params: {
    keys: T[]
    consistentRead?: boolean
  }): Promise<GroupedModels<ExtractKeyType<T>>> {
    const {
      Responses: responses,
      UnprocessedKeys: unprocessedKeys,
    } = await this.client
      .batchGet({
        RequestItems: {
          [this.table.tableName]: {
            ConsistentRead: params.consistentRead,
            Keys: params.keys.map(({ partitionKey, sortKey }) => ({
              [this.table.partitionKeyName]: partitionKey,
              [this.table.sortKeyName]: sortKey,
            })),
          },
        },
      })
      .promise()

    if (unprocessedKeys !== undefined) {
      console.error("Some keys didn't process", unprocessedKeys)
    }

    const modelTags = params.keys.map((_) => _.modelTag)

    if (responses !== undefined) {
      const items = responses[this.table.tableName]
      const jsonItemPromises = items.map(async (_) => {
        const item = await decryptOrPassThroughItem(this.jayz, _)
        return toJSON<ExtractKeyType<T>>(item)
      })

      const jsonItems = await Promise.all(jsonItemPromises)
      return groupModelsByType(jsonItems, modelTags)
    } else {
      return groupModelsByType<ExtractKeyType<T>>([], modelTags)
    }
  }

  query<T extends TaggedModel>(
    key: PartitionKey<T> | PartitionKeyAndSortKeyPrefix<T>,
    options: QueryOptions = {}
  ): QueryBuilder<T> {
    const { table, jayz } = this
    return new QueryBuilder<T>({
      db: this.client,
      table,
      key,
      jayz: jayz,
      consistentRead: options.consistentRead,
    })
  }

  queryGSI<T extends TaggedModel>(
    gsiName: string,
    gsiKey: PartitionKey<T>,
    options: QueryOptions = {}
  ): QueryBuilder<T> {
    const { table, jayz } = this
    return new QueryBuilder<T>({
      db: this.client,
      table,
      gsiName,
      gsiKey,
      jayz,
      consistentRead: options.consistentRead,
    })
  }

  /** Write an item into Dynamo */
  async put<T extends TaggedModel>(item: T): Promise<void> {
    const maybeEncryptedItem = await this.maybeEncryptItems(item)

    await this.client
      .put({
        TableName: this.table.tableName,
        Item: maybeEncryptedItem,
      })
      .promise()
  }

  /** Write multiple items into Dynamo using a transaction.
   */
  async batchPutWithTransaction<T extends TaggedModel>(params: {
    items: T[]
  }): Promise<void> {
    const asyncEncryptedItems = params.items.map(async (item) => {
      const maybeEncryptedItem = await this.maybeEncryptItems(item)
      return {
        Put: { TableName: this.table.tableName, Item: maybeEncryptedItem },
      }
    })

    const encryptedItems = await Promise.all(asyncEncryptedItems)

    await this.client
      .transactWrite({
        TransactItems: encryptedItems,
      })
      .promise()
  }

  private async maybeEncryptItems<T extends TaggedModel>(
    item: T
  ): Promise<MaybeEncryptedItems<T>> {
    const { jayz, table } = this

    return await encryptOrPassThroughItems(
      jayz,
      item,
      table.getEncryptionBlacklist()
    )
  }
}
