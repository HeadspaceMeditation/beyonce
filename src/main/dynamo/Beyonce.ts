import { DynamoDB } from "aws-sdk"
import { JayZConfig } from "./JayZConfig"
import { Key } from "./Key"
import { Model } from "./Model"
import { QueryBuilder } from "./QueryBuilder"
import {
  decryptOrPassThroughItem,
  encryptOrPassThroughItems,
  ItemAndKey,
  MaybeEncryptedItems,
  PartitionAndSortKey,
  toJSON,
} from "./util"

export type Options = {
  jayz?: JayZConfig
}

/** A thin wrapper around the DynamoDB sdk client that
 * does auto mapping between JSON <=> DynamoDB Items
 */
export class Beyonce {
  private client: DynamoDB.DocumentClient
  private jayz?: JayZConfig

  constructor(
    private tableName: string,
    dynamo: DynamoDB,
    options: Options = {}
  ) {
    this.client = new DynamoDB.DocumentClient({ service: dynamo })

    if (options.jayz !== undefined) {
      this.jayz = options.jayz
    }
  }

  /** Retrieve a single Item out of Dynamo */
  async get<T extends Model, U extends Model>(
    key: PartitionAndSortKey<T, U>
  ): Promise<U | undefined> {
    const { Item: item } = await this.client
      .get({
        TableName: this.tableName,
        Key: {
          [key.partition.name]: key.partition.value,
          [key.sort.name]: key.sort.value,
        },
      })
      .promise()

    if (item !== undefined) {
      return toJSON<U>(await decryptOrPassThroughItem(this.jayz, item))
    }
  }

  /** BatchGet items */
  async batchGet<T extends Model>(params: {
    keys: PartitionAndSortKey<any, T>[]
  }): Promise<T[]> {
    const {
      Responses: responses,
      UnprocessedKeys: unprocessedKeys,
    } = await this.client
      .batchGet({
        RequestItems: {
          [this.tableName]: {
            Keys: params.keys.map(({ partition, sort }) => ({
              [partition.name]: partition.value,
              [sort.name]: sort.value,
            })),
          },
        },
      })
      .promise()

    if (unprocessedKeys !== undefined) {
      console.error("Some keys didn't process", unprocessedKeys)
    }

    if (responses !== undefined) {
      const items = responses[this.tableName]
      const jsonItems = items.map(async (_) => {
        const item = await decryptOrPassThroughItem(this.jayz, _)
        return toJSON<T>(item)
      })

      return Promise.all(jsonItems)
    } else {
      return []
    }
  }

  query<T extends Model>(pk: Key<T>): QueryBuilder<T> {
    const { tableName, jayz } = this
    return new QueryBuilder<T>({
      db: this.client,
      tableName,
      pk,
      jayz: jayz,
    })
  }

  queryGSI<T extends Model>(gsiName: string, gsiPk: Key<T>): QueryBuilder<T> {
    const { tableName, jayz } = this
    return new QueryBuilder<T>({
      db: this.client,
      tableName,
      gsiName,
      gsiPk,
      jayz,
    })
  }

  /** Write an item into Dynamo */
  async put<T extends Model, U extends Model>(
    itemAndKey: ItemAndKey<T, U>
  ): Promise<void> {
    const item = await this.maybeEncryptItems(itemAndKey)

    await this.client
      .put({
        TableName: this.tableName,
        Item: item,
      })
      .promise()
  }

  /** Write multiple items into Dynamo using a transaction.
   */
  async batchPutWithTransaction<T extends Model, U extends Model>(
    items: ItemAndKey<T, U>[]
  ): Promise<void> {
    const asyncEncryptedItems = items.map(async (itemAndKey) => {
      const maybeEncryptedItem = await this.maybeEncryptItems(itemAndKey)
      return { Put: { TableName: this.tableName, Item: maybeEncryptedItem } }
    })

    const encryptedItems = await Promise.all(asyncEncryptedItems)

    await this.client
      .transactWrite({
        TransactItems: encryptedItems,
      })
      .promise()
  }

  private async maybeEncryptItems<T extends Model, U extends Model>(
    itemAndKey: ItemAndKey<T, U>
  ): Promise<MaybeEncryptedItems<U>> {
    const { item, key } = itemAndKey
    const maybeEncryptedItems = await encryptOrPassThroughItems(this.jayz, {
      ...item,
      [key.partition.name]: key.partition.value,
      [key.sort.name]: key.sort.value,
    })

    return maybeEncryptedItems
  }
}
