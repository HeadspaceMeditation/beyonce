import { JayZ } from "@ginger.io/jay-z"
import { DynamoDB } from "aws-sdk"
import { DocumentClient } from "aws-sdk/clients/dynamodb"
import { QueryExpressionBuilder } from "./expressions/QueryExpressionBuilder"
import { groupModelsByType } from "./groupModelsByType"
import { PartitionKey, PartitionKeyAndSortKeyPrefix } from "./keys"
import {
  groupAllPages,
  IteratorOptions,
  pagedIterator,
  PaginatedQueryResults,
} from "./pagedIterator"
import { Table } from "./Table"
import { GroupedModels, TaggedModel } from "./types"

type TableQueryConfig<T extends TaggedModel> = {
  db: DynamoDB.DocumentClient
  table: Table
  key: PartitionKey<T> | PartitionKeyAndSortKeyPrefix<T>
  jayz?: JayZ
  consistentRead?: boolean
}

type GSIQueryConfig<T extends TaggedModel> = {
  db: DynamoDB.DocumentClient
  table: Table
  gsiName: string
  gsiKey: PartitionKey<T>
  jayz?: JayZ
  consistentRead?: boolean
}

/** Builds and executes parameters for a DynamoDB Query operation */
export class QueryBuilder<T extends TaggedModel> extends QueryExpressionBuilder<
  T
> {
  private scanIndexForward: boolean = true
  private modelTags: string[] = getModelTags(this.config)

  constructor(private config: TableQueryConfig<T> | GSIQueryConfig<T>) {
    super()
  }

  reverse(): this {
    this.scanIndexForward = false
    return this
  }

  async exec(): Promise<GroupedModels<T>> {
    const iterator = pagedIterator<DocumentClient.QueryInput, T>(
      {},
      (options) => this.buildQuery(options),
      (query) => this.config.db.query(query).promise(),
      this.config.jayz
    )

    return groupAllPages(iterator, this.modelTags)
  }

  async *iterator(options: IteratorOptions = {}): PaginatedQueryResults<T> {
    const iterator = pagedIterator<DocumentClient.QueryInput, T>(
      options,
      (options) => this.buildQuery(options),
      (query) => this.config.db.query(query).promise(),
      this.config.jayz
    )

    for await (const response of iterator) {
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

  private buildKeyConditionForTable(config: TableQueryConfig<T>): string {
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

  private buildKeyConditionForGSI(config: GSIQueryConfig<T>): string {
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
  query: TableQueryConfig<T> | GSIQueryConfig<T>
): query is TableQueryConfig<T> {
  return (query as any).key !== undefined
}

function isPartitionKeyWithSortKeyPrefix<T extends TaggedModel>(
  key: PartitionKey<T> | PartitionKeyAndSortKeyPrefix<T>
): key is PartitionKeyAndSortKeyPrefix<T> {
  return (key as any).sortKeyPrefix !== undefined
}

function getModelTags<T extends TaggedModel>(
  config: TableQueryConfig<T> | GSIQueryConfig<T>
): T["model"][] {
  const key = isTableQuery(config) ? config.key : config.gsiKey
  return isPartitionKeyWithSortKeyPrefix(key) ? [key.modelTag] : key.modelTags
}
