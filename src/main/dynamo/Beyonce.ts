import { JayZ } from "@ginger.io/jay-z"
import { DynamoDB } from "aws-sdk"
import { captureAWSClient } from "aws-xray-sdk"
import { UpdateItemExpressionBuilder } from "./expressions/UpdateItemExpressionBuilder"
import { groupModelsByType } from "./groupModelsByType"
import {
  PartitionAndSortKey,
  PartitionKey,
  PartitionKeyAndSortKeyPrefix
} from "./keys"
import { QueryBuilder } from "./QueryBuilder"
import { ParallelScanConfig, ScanBuilder } from "./ScanBuilder"
import { Table } from "./Table"
import { ExtractKeyType, GroupedModels, TaggedModel } from "./types"
import { updateItemProxy } from "./updateItemProxy"
import {
  decryptOrPassThroughItem,
  encryptOrPassThroughItem,
  MaybeEncryptedItem
} from "./util"

export interface Options {
  jayz?: JayZ
  xRayTracingEnabled?: boolean
  consistentReads?: boolean
}

export interface GetOptions {
  consistentRead?: boolean
}

export interface QueryOptions {
  consistentRead?: boolean
}

export interface ScanOptions {
  consistentRead?: boolean
  parallel?: ParallelScanConfig
}

/** A thin wrapper around the DynamoDB sdk client that
 * does auto mapping between JSON <=> DynamoDB Items
 */
export class Beyonce {
  private client: DynamoDB.DocumentClient
  private jayz?: JayZ
  private consistentReads: boolean

  constructor(
    private table: Table<string, string>,
    dynamo: DynamoDB,
    options: Options = {}
  ) {
    this.client = new DynamoDB.DocumentClient({ service: dynamo })
    if (options.xRayTracingEnabled) {
      // hack per: https://github.com/aws/aws-xray-sdk-node/issues/23#issuecomment-509745488
      captureAWSClient((this.client as any).service)
    }

    if (options.jayz !== undefined) {
      this.jayz = options.jayz
    }

    if (options.consistentReads !== undefined) {
      this.consistentReads = options.consistentReads
    } else {
      this.consistentReads = false
    }
  }

  /** Retrieve a single Item out of Dynamo */
  async get<T extends TaggedModel>(
    key: PartitionAndSortKey<T>,
    options: GetOptions = {}
  ): Promise<T | undefined> {
    const useConsistentRead =
      options.consistentRead !== undefined
        ? options.consistentRead
        : this.consistentReads

    const { Item: item } = await this.client
      .get({
        TableName: this.table.tableName,
        ConsistentRead: useConsistentRead,
        Key: {
          [this.table.partitionKeyName]: key.partitionKey,
          [this.table.sortKeyName]: key.sortKey
        }
      })
      .promise()

    if (item !== undefined) {
      const maybeDecryptedItem = await decryptOrPassThroughItem(this.jayz, item)
      return maybeDecryptedItem as T
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
          [this.table.sortKeyName]: key.sortKey
        }
      })
      .promise()
  }

  /** BatchGet items */
  async batchGet<T extends PartitionAndSortKey<TaggedModel>>(params: {
    keys: T[]
    consistentRead?: boolean
  }): Promise<GroupedModels<ExtractKeyType<T>>> {
    const useConsistentRead =
      params.consistentRead !== undefined
        ? params.consistentRead
        : this.consistentReads

    const {
      Responses: responses,
      UnprocessedKeys: unprocessedKeys
    } = await this.client
      .batchGet({
        RequestItems: {
          [this.table.tableName]: {
            ConsistentRead: useConsistentRead,
            Keys: params.keys.map(({ partitionKey, sortKey }) => ({
              [this.table.partitionKeyName]: partitionKey,
              [this.table.sortKeyName]: sortKey
            }))
          }
        }
      })
      .promise()

    if (
      unprocessedKeys !== undefined &&
      Object.keys(unprocessedKeys).length > 0
    ) {
      throw new Error(
        `Some keys didn't process: ${JSON.stringify(unprocessedKeys)}`
      )
    }

    const modelTags = params.keys.map((_) => _.modelTag)

    if (responses !== undefined) {
      const items = responses[this.table.tableName]
      const jsonItemPromises = items.map(async (item) => {
        const maybeDecryptedItem = await decryptOrPassThroughItem(
          this.jayz,
          item
        )
        return maybeDecryptedItem as ExtractKeyType<T>
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

    const useConsistentRead =
      options.consistentRead !== undefined
        ? options.consistentRead
        : this.consistentReads

    return new QueryBuilder<T>({
      db: this.client,
      table,
      key,
      jayz: jayz,
      consistentRead: useConsistentRead
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
      consistentRead: options.consistentRead
    })
  }

  scan<T extends TaggedModel = TaggedModel>(
    options: ScanOptions = {}
  ): ScanBuilder<T> {
    return new ScanBuilder<T>({
      db: this.client,
      table: this.table,
      jayz: this.jayz,
      ...options
    })
  }

  /** Write an item into Dynamo */
  async put<T extends TaggedModel>(item: T): Promise<void> {
    const maybeEncryptedItem = await this.maybeEncryptItem(item)
    await this.client
      .put({
        TableName: this.table.tableName,
        Item: maybeEncryptedItem
      })
      .promise()
  }

  /** Performs a (partial) update on an existing item in Dynamo.
   *  Partial updates do not work with JayZ encryption and this method
   *  will throw an error if you attempt to use it with JayZ enabled.
   */
  async update<T extends TaggedModel>(
    key: PartitionAndSortKey<T>,
    updateFunc: (lens: T) => void
  ): Promise<T> {
    if (this.jayz) {
      throw new Error(
        "You can't perform partial updates on items with JayZ encryption enabled"
      )
    }

    const expBuilder = new UpdateItemExpressionBuilder()
    const proxy = updateItemProxy<T>(expBuilder)
    updateFunc(proxy)
    const keyConditionExp = expBuilder.buildKeyConditionExpression(key)
    const { expression, attributeNames, attributeValues } = expBuilder.build()

    const hasValues = Object.keys(attributeValues).length > 0

    const result = await this.client
      .update({
        TableName: this.table.tableName,
        ConditionExpression: keyConditionExp,
        Key: {
          [this.table.partitionKeyName]: key.partitionKey,
          [this.table.sortKeyName]: key.sortKey
        },
        UpdateExpression: expression,
        ExpressionAttributeNames: attributeNames,
        ExpressionAttributeValues: hasValues ? attributeValues : undefined,
        ReturnValues: "ALL_NEW" // return item after update applied
      })
      .promise()

    if (result.Attributes !== undefined) {
      return result.Attributes as T
    } else {
      throw new Error(
        `Item pk: ${key.partitionKey}, sk: ${key.sortKey} not found`
      )
    }
  }

  /** Write multiple items into Dynamo using a transaction.
   *
   *  @deprecated -- use batchWriteWithTransaction
   */
  async batchPutWithTransaction<T extends TaggedModel>(params: {
    items: T[]
  }): Promise<void> {
    const { items } = params
    await this.batchWriteWithTransaction({ putItems: items })
  }

  async batchWrite<T extends TaggedModel>(params: {
    putItems?: T[]
    deleteItems?: PartitionAndSortKey<T>[]
  }): Promise<{
    unprocessedPuts: T[]
    unprocessedDeletes: PartitionAndSortKey<T>[]
  }> {
    const { tableName, partitionKeyName, sortKeyName } = this.table
    const { putItems = [], deleteItems = [] } = params
    const requests: DynamoDB.DocumentClient.WriteRequest[] = []

    const maybeEncryptedPutPromises = putItems.map(async (item) => {
      const maybeEncryptedItem = await this.maybeEncryptItem(item)
      requests.push({ PutRequest: { Item: maybeEncryptedItem } })
    })

    const deleteItemsByKey: { [key: string]: PartitionAndSortKey<T> } = {}
    deleteItems.forEach((key) => {
      deleteItemsByKey[`${key.partitionKey}-${key.sortKey}`] = key
      requests.push({
        DeleteRequest: {
          Key: {
            [partitionKeyName]: key.partitionKey,
            [sortKeyName]: key.sortKey
          }
        }
      })
    })

    await Promise.all(maybeEncryptedPutPromises)
    const { UnprocessedItems } = await this.client
      .batchWrite({ RequestItems: { [tableName]: requests } })
      .promise()

    const unprocessedPuts: T[] = []
    const unprocessedDeletes: PartitionAndSortKey<T>[] = []
    if (UnprocessedItems && UnprocessedItems[tableName]) {
      UnprocessedItems[tableName].forEach(({ PutRequest, DeleteRequest }) => {
        if (PutRequest) {
          unprocessedPuts.push(PutRequest.Item as T)
        } else if (DeleteRequest) {
          const { Key: key } = DeleteRequest
          unprocessedDeletes.push(
            deleteItemsByKey[`${key[partitionKeyName]}-${key[sortKeyName]}`]
          )
        }
      })
    }

    return { unprocessedPuts, unprocessedDeletes }
  }

  /** Perform N Dynamo operations in an atomic transaction */
  async batchWriteWithTransaction<T extends TaggedModel>(params: {
    putItems?: T[]
    deleteItems?: PartitionAndSortKey<T>[]
  }): Promise<void> {
    const { putItems = [], deleteItems = [] } = params
    const requests: DynamoDB.DocumentClient.TransactWriteItem[] = []
    const maybeEncryptedPutPromises = putItems.map(async (item) => {
      const maybeEncryptedItem = await this.maybeEncryptItem(item)
      requests.push(this.toTransactPut(maybeEncryptedItem))
    })

    deleteItems.forEach((key) => requests.push(this.toTransactDelete(key)))
    await Promise.all(maybeEncryptedPutPromises)
    await this.client.transactWrite({ TransactItems: requests }).promise()
  }

  private toTransactPut<T extends TaggedModel>(
    item: MaybeEncryptedItem<T>
  ): DynamoDB.DocumentClient.TransactWriteItem {
    return {
      Put: {
        TableName: this.table.tableName,
        Item: item
      }
    }
  }

  private toTransactDelete<T extends TaggedModel>(
    key: PartitionAndSortKey<T>
  ): DynamoDB.DocumentClient.TransactWriteItem {
    return {
      Delete: {
        TableName: this.table.tableName,
        Key: {
          [this.table.partitionKeyName]: key.partitionKey,
          [this.table.sortKeyName]: key.sortKey
        }
      }
    }
  }

  private async maybeEncryptItem<T extends TaggedModel>(
    item: T
  ): Promise<MaybeEncryptedItem<T>> {
    const { jayz, table } = this

    return await encryptOrPassThroughItem(
      jayz,
      item,
      table.getEncryptionBlacklist()
    )
  }
}
