import { DynamoDB } from "aws-sdk"
import { Key } from "./Key"
import { Model } from "./Model"
import { QueryBuilder } from "./QueryBuilder"
import { toJSON } from "./util"

type PartitionAndSortKey<T extends Model, U extends Model> = {
  partition: Key<T>
  sort: Key<U>
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
  async get<T extends Model, U extends Model>(
    keys: PartitionAndSortKey<T, U>
  ): Promise<U | undefined> {
    const { Item: item } = await this.client
      .get({
        TableName: this.tableName,
        Key: {
          [keys.partition.name]: keys.partition.value,
          [keys.sort.name]: keys.sort.value
        }
      })
      .promise()

    if (item !== undefined) {
      return toJSON<U>(item)
    }
  }

  /** BatchGet items */
  async batchGet<T extends Model>(params: {
    keys: PartitionAndSortKey<any, T>[]
  }): Promise<T[]> {
    const {
      Responses: responses,
      UnprocessedKeys: unprocessedKeys
    } = await this.client
      .batchGet({
        RequestItems: {
          [this.tableName]: {
            Keys: params.keys.map(({ partition, sort }) => ({
              [partition.name]: partition.value,
              [sort.name]: sort.value
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

  query<T extends Model>(pk: Key<T>): QueryBuilder<T> {
    return new QueryBuilder<T>(this.client, this.tableName, pk)
  }

  /** Write an item into Dynamo */
  async put<T extends Model, U extends Model>(
    keys: PartitionAndSortKey<T, U>,
    fields: U
  ): Promise<void> {
    await this.client
      .put({
        TableName: this.tableName,
        Item: {
          ...fields,
          [keys.partition.name]: keys.partition.value,
          [keys.sort.name]: keys.sort.value
        }
      })
      .promise()
  }
}
