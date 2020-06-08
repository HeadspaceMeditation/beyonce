import { JayZ } from "@ginger.io/jay-z"
import { DynamoDB } from "aws-sdk"
import { groupModelsByType } from "./groupModelsByType"
import { PartitionKey, PartitionKeyAndSortKeyPrefix } from "./keys"
import { QueryExpressionBuilder } from "./expressions/QueryExpressionBuilder"
import { Table } from "./Table"
import { GroupedModels, TaggedModel } from "./types"
import { decryptOrPassThroughItem, toJSON } from "./util"

type TableQueryParams<T extends TaggedModel> = {
  db: DynamoDB.DocumentClient
  table: Table
  key: PartitionKey<T> | PartitionKeyAndSortKeyPrefix<T>
  jayz?: JayZ
  consistentRead?: boolean
}

type GSIQueryParams<T extends TaggedModel> = {
  db: DynamoDB.DocumentClient
  table: Table
  gsiName: string
  gsiKey: PartitionKey<T>
  jayz?: JayZ
  consistentRead?: boolean
}

export type Cursor = Record<string, any>

export type IteratorOptions = {
  cursor?: Cursor
  pageSize?: number
}

export type PaginatedQueryResults<T extends TaggedModel> = AsyncGenerator<
  QueryResults<T>,
  QueryResults<T>
>

export type QueryResults<T extends TaggedModel> = {
  items: GroupedModels<T>
  cursor?: Cursor
}

type RawQueryResults<T extends TaggedModel> = {
  items: T[]
  lastEvaluatedKey?: DynamoDB.DocumentClient.Key
}

/** Builds and executes parameters for a DynamoDB Query operation */
export class QueryBuilder<T extends TaggedModel> extends QueryExpressionBuilder<
  T
  > {
  private scanIndexForward: boolean = true
  private modelTags: string[] = getModelTags(this.config)

  constructor(private config: TableQueryParams<T> | GSIQueryParams<T>) {
    super()
  }

  reverse(): this {
    this.scanIndexForward = false
    return this
  }

  async exec(): Promise<GroupedModels<T>> {
    const results: T[] = []
    for await (const { items } of this.executeQuery()) {
      results.push(...items)
    }

    return groupModelsByType(results, this.modelTags)
  }

  async *iterator(options: IteratorOptions = {}): PaginatedQueryResults<T> {
    for await (const response of this.executeQuery(options)) {
      yield {
        items: groupModelsByType(response.items, this.modelTags),
        cursor: response.lastEvaluatedKey,
      }
    }

    return {
      items: groupModelsByType<T>([], this.modelTags),
      cursor: undefined,
    }
  }

  private async *executeQuery(
    options: IteratorOptions = {}
  ): AsyncGenerator<RawQueryResults<T>, RawQueryResults<T>> {
    const { db } = this.config

    let pendingQuery:
      | DynamoDB.DocumentClient.QueryInput
      | undefined = this.buildQuery(options)

    while (pendingQuery !== undefined) {
      const response: DynamoDB.DocumentClient.QueryOutput = await db
        .query(pendingQuery)
        .promise()

      if (response.LastEvaluatedKey !== undefined) {
        pendingQuery = this.buildQuery({
          ...options,
          cursor: response.LastEvaluatedKey,
        })
      } else {
        pendingQuery = undefined
      }

      const itemsToProcess = response.Items || []
      const jsonItemPromises = itemsToProcess.map(async (_) => {
        const item = await decryptOrPassThroughItem(this.config.jayz, _)
        return toJSON<T>(item)
      })

      const items = await Promise.all(jsonItemPromises)
      yield { items, lastEvaluatedKey: response.LastEvaluatedKey }
    }

    return { items: [] as T[], lastEvaluatedKey: undefined }
  }

  private buildQuery(
    options: IteratorOptions
  ): DynamoDB.DocumentClient.QueryInput {
    if (isTableQuery(this.config)) {
      const { table, consistentRead } = this.config
      const keyCondition = this.buildKeyConditionForTable(this.config)
      const { expression, attributeNames, attributeValues } = this.build()
      const filterExp = expression !== "" ? expression : undefined

      return {
        TableName: table.tableName,
        ConsistentRead: consistentRead,
        KeyConditionExpression: keyCondition,
        ExpressionAttributeNames: attributeNames,
        ExpressionAttributeValues: attributeValues,
        FilterExpression: filterExp,
        ExclusiveStartKey: options.cursor,
        ScanIndexForward: this.scanIndexForward,
        Limit: options.pageSize,
      }
    } else {
      const { table, consistentRead } = this.config
      const keyCondition = this.buildKeyConditionForGSI(this.config)
      const { expression, attributeNames, attributeValues } = this.build()
      const filterExp = expression !== "" ? expression : undefined

      return {
        TableName: table.tableName,
        ConsistentRead: consistentRead,
        IndexName: this.config.gsiName,
        KeyConditionExpression: keyCondition,
        ExpressionAttributeNames: attributeNames,
        ExpressionAttributeValues: attributeValues,
        FilterExpression: filterExp,
        ExclusiveStartKey: options.cursor,
        ScanIndexForward: this.scanIndexForward,
        Limit: options.pageSize,
      }
    }
  }

  private buildKeyConditionForTable(config: TableQueryParams<T>): string {
    const { key } = config
    const pkPlaceholder = this.addAttributeName(key.partitionKeyName)
    const pkValuePlaceholder = this.addAttributeValue(
      key.partitionKeyName,
      key.partitionKey
    )
    const keyConditionExpression = [`${pkPlaceholder} = ${pkValuePlaceholder}`]

    if (isPartitionKeyWithSortKeyPrefix(key)) {
      const { sortKeyName, sortKeyPrefix } = key
      const skPlaceholder = this.addAttributeName(sortKeyName)
      const skValuePlaceholder = this.addAttributeValue(
        sortKeyName,
        sortKeyPrefix
      )
      keyConditionExpression.push(
        `begins_with(${skPlaceholder}, ${skValuePlaceholder})`
      )
    }

    return keyConditionExpression.join(" AND ")
  }

  private buildKeyConditionForGSI(config: GSIQueryParams<T>): string {
    const { gsiKey } = config
    const pkPlaceholder = this.addAttributeName(gsiKey.partitionKeyName)
    const pkValuePlaceholder = this.addAttributeValue(
      gsiKey.partitionKeyName,
      gsiKey.partitionKey
    )

    return `${pkPlaceholder} = ${pkValuePlaceholder}`
  }
}

function isTableQuery<T extends TaggedModel>(
  query: TableQueryParams<T> | GSIQueryParams<T>
): query is TableQueryParams<T> {
  return (query as any).key !== undefined
}

function isPartitionKeyWithSortKeyPrefix<T extends TaggedModel>(
  key: PartitionKey<T> | PartitionKeyAndSortKeyPrefix<T>
): key is PartitionKeyAndSortKeyPrefix<T> {
  return (key as any).sortKeyPrefix !== undefined
}

function getModelTags<T extends TaggedModel>(
  config: TableQueryParams<T> | GSIQueryParams<T>
): T["model"][] {
  const key = isTableQuery(config) ? config.key : config.gsiKey
  return isPartitionKeyWithSortKeyPrefix(key) ? [key.modelTag] : key.modelTags
}
