import {DynamoDB} from "aws-sdk"
import {captureAWSClient} from "aws-xray-sdk"
import {UpdateItemExpressionBuilder} from "./expressions/UpdateItemExpressionBuilder"
import {groupModelsByType} from "./groupModelsByType"
import {PartitionAndSortKey, PartitionKey, PartitionKeyAndSortKeyPrefix} from "./keys"
import {batchGetItems} from "./operations/batchGetItems"
import {batchWriteItems} from "./operations/batchWriteItems"
import {deleteItem} from "./operations/deleteItem"
import {getItem} from "./operations/getItem"
import {putItem} from "./operations/putItem"
import {transactWriteItems} from "./operations/transactWriteItems"
import {updateItem} from "./operations/updateItem"
import {QueryBuilder} from "./QueryBuilder"
import {ParallelScanConfig, ScanBuilder} from "./ScanBuilder"
import {Table} from "./Table"
import {ExtractKeyType, GroupedModels, TaggedModel} from "./types"
import {updateItemProxy} from "./updateItemProxy"

export interface Options {
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
  private consistentReads: boolean

  constructor(private table: Table<string, string>, dynamo: DynamoDB, options: Options = {}) {
    this.client = new DynamoDB.DocumentClient({ service: dynamo })
    if (options.xRayTracingEnabled) {
      // hack per: https://github.com/aws/aws-xray-sdk-node/issues/23#issuecomment-509745488
      captureAWSClient((this.client as any).service)
    }

    if (options.consistentReads !== undefined) {
      this.consistentReads = options.consistentReads
    } else {
      this.consistentReads = false
    }
  }

  /** Retrieve a single Item out of Dynamo */
  async get<T extends TaggedModel>(key: PartitionAndSortKey<T>, options: GetOptions = {}): Promise<T | undefined> {
    const consistentRead = options.consistentRead !== undefined ? options.consistentRead : this.consistentReads
    const { item } = await getItem({ table: this.table, client: this.client, key, consistentRead })
    return item as T;
  }

  /** Write an item into Dynamo */
  async put<T extends TaggedModel>(item: T): Promise<void> {
    await putItem({ table: this.table, client: this.client, item: item })
  }

  /** Performs a (partial) update on an existing item in Dynamo.*/
  async update<T extends TaggedModel>(key: PartitionAndSortKey<T>, updateFunc: (lens: T) => void): Promise<T> {

    const expBuilder = new UpdateItemExpressionBuilder()
    const proxy = updateItemProxy<T>(expBuilder)
    updateFunc(proxy)
    const keyConditionExpression = expBuilder.buildKeyConditionExpression(key)

    const { item } = await updateItem({
      table: this.table,
      client: this.client,
      key,
      keyConditionExpression,
      updateExpression: expBuilder.build()
    })
    return item
  }

  async delete<T extends TaggedModel>(key: PartitionAndSortKey<T>): Promise<void> {
    await deleteItem({ table: this.table, client: this.client, key })
  }

  /** BatchGet items */
  async batchGet<T extends PartitionAndSortKey<TaggedModel>>(params: {
    keys: T[]
    consistentRead?: boolean
  }): Promise<{ items: GroupedModels<ExtractKeyType<T>>; unprocessedKeys: T[] }> {
    const { keys, consistentRead } = params

    if (keys.length === 0) {
      groupModelsByType<ExtractKeyType<T>>([], [])
    }

    const modelTags = keys.map((_) => _.modelTag)
    const requestsInFlight: Promise<{ items: ExtractKeyType<T>[]; unprocessedKeys: T[] }>[] = []

    // Chunk keys into N concurrent requests
    // as DynamoDB has a max of 100 keys per batchGet requests
    const batchSize = 100
    let batchStartIndex = 0
    let batchEndIndex = batchSize
    while (batchStartIndex < keys.length) {
      const batchedKeys = keys.slice(batchStartIndex, batchEndIndex)
      requestsInFlight.push(this.doSingleBatchGet({ keys: batchedKeys, consistentRead }))
      batchStartIndex = batchEndIndex
      batchEndIndex += batchSize
    }

    const results = await Promise.all(requestsInFlight)
    const items: ExtractKeyType<T>[] = []
    const unprocessedKeys: T[] = []
    results.forEach((result) => {
      items.push(...result.items)
      unprocessedKeys.push(...result.unprocessedKeys)
    })

    return { items: groupModelsByType(items, modelTags), unprocessedKeys }
  }

  async batchWrite<T extends TaggedModel>(params: {
    putItems?: T[]
    deleteItems?: PartitionAndSortKey<T>[]
  }): Promise<{
    unprocessedPuts: T[]
    unprocessedDeletes: PartitionAndSortKey<T>[]
  }> {
    const { putItems = [], deleteItems = [] } = params
    return await batchWriteItems({ table: this.table, client: this.client, putItems: putItems, deleteItems })
  }

  /**
   * Perform N Dynamo operations in an atomic transaction.
   *
   * @param params.putItems Set `failIfNotUnique` to true on a record within putItems to cancel the transaction if a
   *  record with the same partition key and sort key (if applicable) already exists.
   */
  async batchWriteWithTransaction<T extends TaggedModel>(params: {
    clientRequestToken?: string
    putItems?: (T & { failIfNotUnique?: boolean })[]
    deleteItems?: PartitionAndSortKey<T>[]
  }): Promise<void> {
    const { clientRequestToken, putItems = [], deleteItems = [] } = params
    const putPromises = putItems.map(async ({ failIfNotUnique, ...item }) => {
      return {
        item: item as T,
        failIfNotUnique
      }
    })
    const putPromisesItems = await Promise.all(putPromises)
    await transactWriteItems({
      table: this.table,
      client: this.client,
      clientRequestToken,
      putItems: putPromisesItems,
      deleteItems
    })
  }

  query<T extends TaggedModel>(
    key: PartitionKey<T> | PartitionKeyAndSortKeyPrefix<T>,
    options: QueryOptions = {}
  ): QueryBuilder<T> {
    const { table } = this
    const useConsistentRead = options.consistentRead !== undefined ? options.consistentRead : this.consistentReads

    return new QueryBuilder<T>({
      db: this.client,
      table,
      key,
      consistentRead: useConsistentRead
    })
  }

  queryGSI<T extends TaggedModel>(
    gsiName: string,
    gsiKey: PartitionKey<T>,
    options: QueryOptions = {}
  ): QueryBuilder<T> {
    const { table } = this
    return new QueryBuilder<T>({
      db: this.client,
      table,
      gsiName,
      gsiKey,
      consistentRead: options.consistentRead
    })
  }

  scan<T extends TaggedModel = TaggedModel>(options: ScanOptions = {}): ScanBuilder<T> {
    return new ScanBuilder<T>({
      db: this.client,
      table: this.table,
      ...options
    })
  }

  private async doSingleBatchGet<T extends PartitionAndSortKey<TaggedModel>>(params: {
    keys: T[]
    consistentRead?: boolean
  }): Promise<{ items: ExtractKeyType<T>[]; unprocessedKeys: T[] }> {
    const consistentRead = params.consistentRead !== undefined ? params.consistentRead : this.consistentReads

    const { items, unprocessedKeys } = await batchGetItems({
      table: this.table,
      client: this.client,
      consistentRead,
      keys: params.keys
    })

    const jsonItemPromises = items.map(async (item) => {
      return item as ExtractKeyType<T>
    })

    return { items: await Promise.all(jsonItemPromises), unprocessedKeys }
  }
}
