import { JayZ } from "@ginger.io/jay-z"
import { DynamoDB } from "aws-sdk"
import { DocumentClient } from "aws-sdk/clients/dynamodb"
import { ready } from "libsodium-wrappers"
import { QueryExpressionBuilder } from "./expressions/QueryExpressionBuilder"
import { groupModelsByType } from "./groupModelsByType"
import { groupAllPages, pagedIterator } from "./iterators/pagedIterator"
import {
  InternalIteratorOptions,
  IteratorOptions,
  PaginatedIteratorResults
} from "./iterators/types"
import {
  maybeSerializeCursor,
  toInternalIteratorOptions
} from "./iterators/util"
import { PartitionKey, PartitionKeyAndSortKeyPrefix } from "./keys"
import { Table } from "./Table"
import { GroupedModels, TaggedModel } from "./types"

interface TableQueryConfig<T extends TaggedModel> {
  db: DynamoDB.DocumentClient
  table: Table
  key: PartitionKey<T> | PartitionKeyAndSortKeyPrefix<T>
  jayz?: JayZ
  consistentRead?: boolean
}

interface GSIQueryConfig<T extends TaggedModel> {
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
    const query = this.createQueryInput({ lastEvaluatedKey: undefined })
    const iterator = pagedIterator<DocumentClient.QueryInput, T>(
      { lastEvaluatedKey: undefined },
      ({ lastEvaluatedKey, pageSize }) => ({
        ...query,
        ExclusiveStartKey: lastEvaluatedKey,
        Limit: pageSize
      }),
      (query) => this.config.db.query(query).promise(),
      this.config.jayz
    )

    return groupAllPages(iterator, this.modelTags)
  }

  async *iterator(options: IteratorOptions = {}): PaginatedIteratorResults<T> {
    const iteratorOptions = toInternalIteratorOptions(options)
    const query = this.createQueryInput(iteratorOptions)
    const iterator = pagedIterator<DocumentClient.QueryInput, T>(
      iteratorOptions,
      ({ lastEvaluatedKey, pageSize }) => ({
        ...query,
        ExclusiveStartKey: lastEvaluatedKey,
        Limit: pageSize
      }),
      (query) => this.config.db.query(query).promise(),
      this.config.jayz
    )

    await ready
    for await (const response of iterator) {
      yield {
        items: groupModelsByType(response.items, this.modelTags),
        errors: response.errors,
        cursor: maybeSerializeCursor(response.lastEvaluatedKey)
      }
    }

    return {
      items: groupModelsByType<T>([], this.modelTags),
      errors: [],
      cursor: undefined
    }
  }

  private createQueryInput(
    options: InternalIteratorOptions
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
        ExclusiveStartKey: options.lastEvaluatedKey,
        ScanIndexForward: this.scanIndexForward,
        Limit: options.pageSize
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
        ExclusiveStartKey: options.lastEvaluatedKey,
        ScanIndexForward: this.scanIndexForward,
        Limit: options.pageSize
      }
    }
  }

  private buildKeyConditionForTable(config: TableQueryConfig<T>): string {
    const { key } = config
    const pkPlaceholder = this.addAttributeName(key.partitionKeyName)
    const pkValuePlaceholder = this.addAttributeValue(key.partitionKey)
    const keyConditionExpression = [`${pkPlaceholder} = ${pkValuePlaceholder}`]

    if (isPartitionKeyWithSortKeyPrefix(key)) {
      const { sortKeyName, sortKeyPrefix } = key
      const skPlaceholder = this.addAttributeName(sortKeyName)
      const skValuePlaceholder = this.addAttributeValue(sortKeyPrefix)
      keyConditionExpression.push(
        `begins_with(${skPlaceholder}, ${skValuePlaceholder})`
      )
    }

    return keyConditionExpression.join(" AND ")
  }

  private buildKeyConditionForGSI(config: GSIQueryConfig<T>): string {
    const { gsiKey } = config
    const pkPlaceholder = this.addAttributeName(gsiKey.partitionKeyName)
    const pkValuePlaceholder = this.addAttributeValue(gsiKey.partitionKey)

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
