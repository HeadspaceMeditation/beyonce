import { DynamoDB } from "aws-sdk"
import { Key } from "./Key"
import { Model } from "./Model"
import { QueryBuilder } from "./QueryBuilder"
import { toJSON } from "./util"

type KeyInput<T extends Model, U> = [Key<T, U>, U]

type PartitionAndSortKey<T extends Model, U, V extends Model, X> = {
  partition: KeyInput<T, U>
  sort: KeyInput<V, X>
}

/** A thin wrapper around the DynamoDB sdk client that
 * does auto mapping between JSON <=> DynamoDB Items
 */
export class DynamoDBService {
  private client: DynamoDB.DocumentClient
  constructor(private tableName: string, dynamo: DynamoDB = new DynamoDB()) {
    this.client = new DynamoDB.DocumentClient({ service: dynamo })
  }

  /** Retrieve a single Item out of Dynamo */
  async get<T extends Model, U, V extends Model, X>(
    keys: PartitionAndSortKey<T, U, V, X>
  ): Promise<V | undefined> {
    const [pk, pkParts] = keys.partition
    const [sk, skParts] = keys.sort
    const { Item: item } = await this.client
      .get({
        TableName: this.tableName,
        Key: {
          pk: pk.key(pkParts),
          sk: sk.key(skParts)
        }
      })
      .promise()

    if (item !== undefined) {
      return toJSON<V>(item)
    }
  }

  /** BatchGet items */
  async batchGet<T extends Model>(params: {
    keys: {
      partition: string
      sort: string
    }[]
  }): Promise<T[]> {
    const {
      Responses: responses,
      UnprocessedKeys: unprocessedKeys
    } = await this.client
      .batchGet({
        RequestItems: {
          [this.tableName]: {
            Keys: params.keys.map(({ partition, sort }) => ({
              pk: partition,
              sk: sort
            }))
          }
        }
      })
      .promise()

    if (unprocessedKeys !== undefined) {
      console.error("Some keys didn't process", unprocessedKeys)
    }

    if (responses !== undefined) {
      const items = responses[this.tableName]
      return items.map(_ => toJSON<T>(_))
    } else {
      return []
    }
  }

  query<T extends Model, U>(
    partition: Key<T, U>,
    keyParts: U
  ): QueryBuilder<T> {
    return new QueryBuilder<T>(
      this.client,
      this.tableName,
      partition.key(keyParts)
    )
  }

  /** Write an item into Dynamo */
  async put<T extends Model, U, V extends Model, X>(
    keys: PartitionAndSortKey<T, U, V, X>,
    fields: V
  ): Promise<void> {
    const [pk, pkParts] = keys.partition
    const [sk, skParts] = keys.sort
    await this.client
      .put({
        TableName: this.tableName,
        Item: {
          ...fields,
          pk: pk.key(pkParts),
          sk: sk.key(skParts)
        }
      })
      .promise()
  }
}
