import { JayZ } from "@ginger.io/jay-z"
import { DynamoDB } from "aws-sdk"
import { ExpressionBuilder } from "./ExpressionBuilder"
import { groupModelsByType } from "./groupModelsByType"
import { PartitionKey, PartitionKeyAndSortKeyPrefix } from "./keys"
import { Table } from "./Table"
import { GroupedModels, TaggedModel } from "./types"
import { decryptOrPassThroughItem, toJSON } from "./util"

type TableQueryParams<T> = {
  db: DynamoDB.DocumentClient
  table: Table
  key: PartitionKey<T> | PartitionKeyAndSortKeyPrefix<T>
  jayz?: JayZ
}

type GSIQueryParams<T> = {
  db: DynamoDB.DocumentClient
  table: Table
  gsiName: string
  gsiKey: PartitionKey<T>
  jayz?: JayZ
}

export type PaginatedQueryResults<T extends TaggedModel> = AsyncGenerator<
  GroupedModels<T>,
  GroupedModels<T>
>

/** Builds and executes parameters for a DynamoDB Query operation */
export class QueryBuilder<T extends TaggedModel> extends ExpressionBuilder<T> {
  private scanIndexForward: boolean = true

  constructor(private config: TableQueryParams<T> | GSIQueryParams<T>) {
    super()
  }

  reverse(): this {
    this.scanIndexForward = false
    return this
  }

  async *pages(params: { size?: number }): PaginatedQueryResults<T> {
    for await (const page of this.doQuery(params.size)) {
      yield groupModelsByType(page)
    }

    return groupModelsByType<T>([])
  }

  async exec(): Promise<GroupedModels<T>> {
    const results: T[] = []
    for await (const page of this.doQuery()) {
      results.push(...page)
    }

    return groupModelsByType(results)
  }

  private async *doQuery(maxPageSize?: number): AsyncGenerator<T[], T[]> {
    const { db } = this.config
    let pendingQuery:
      | DynamoDB.DocumentClient.QueryInput
      | undefined = this.buildQuery(undefined, maxPageSize)

    while (pendingQuery !== undefined) {
      const response: DynamoDB.DocumentClient.QueryOutput = await db
        .query(pendingQuery)
        .promise()

      if (response.LastEvaluatedKey !== undefined) {
        pendingQuery = this.buildQuery(response.LastEvaluatedKey, maxPageSize)
      } else {
        pendingQuery = undefined
      }

      const jsonItemPromises = (response.Items || []).map(async (_) => {
        const item = await decryptOrPassThroughItem(this.config.jayz, _)
        return toJSON<T>(item)
      })

      yield await Promise.all(jsonItemPromises)
    }

    return [] as T[]
  }

  private buildQuery(
    lastEvaluatedKey?: DynamoDB.DocumentClient.Key,
    limit?: number
  ): DynamoDB.DocumentClient.QueryInput {
    if (isTableQuery(this.config)) {
      const { table } = this.config
      const keyCondition = this.buildKeyConditionForTable(this.config)
      const { expression, attributeNames, attributeValues } = this.build()
      const filterExp = expression !== "" ? expression : undefined

      return {
        TableName: table.tableName,
        KeyConditionExpression: keyCondition,
        ExpressionAttributeNames: attributeNames,
        ExpressionAttributeValues: attributeValues,
        FilterExpression: filterExp,
        ExclusiveStartKey: lastEvaluatedKey,
        ScanIndexForward: this.scanIndexForward,
        Limit: limit,
      }
    } else {
      const { table } = this.config
      const keyCondition = this.buildKeyConditionForGSI(this.config)
      const { expression, attributeNames, attributeValues } = this.build()
      const filterExp = expression !== "" ? expression : undefined

      return {
        TableName: table.tableName,
        IndexName: this.config.gsiName,
        KeyConditionExpression: keyCondition,
        ExpressionAttributeNames: attributeNames,
        ExpressionAttributeValues: attributeValues,
        FilterExpression: filterExp,
        ExclusiveStartKey: lastEvaluatedKey,
        ScanIndexForward: this.scanIndexForward,
        Limit: limit,
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

function isTableQuery<T>(
  query: TableQueryParams<T> | GSIQueryParams<T>
): query is TableQueryParams<T> {
  return (query as any).key !== undefined
}

function isPartitionKeyWithSortKeyPrefix<T>(
  key: PartitionKey<T> | PartitionKeyAndSortKeyPrefix<T>
): key is PartitionKeyAndSortKeyPrefix<T> {
  return (key as any).sortKeyPrefix !== undefined
}
