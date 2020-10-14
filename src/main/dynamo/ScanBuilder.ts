import { JayZ } from "@ginger.io/jay-z"
import { DynamoDB } from "aws-sdk"
import { DocumentClient } from "aws-sdk/clients/dynamodb"
import { QueryExpressionBuilder } from "./expressions/QueryExpressionBuilder"
import { groupModelsByType } from "./groupModelsByType"
import {
  groupAllPages,
  IteratorOptions,
  pagedIterator,
  PaginatedQueryResults,
} from "./pagedIterator"
import { Table } from "./Table"
import { GroupedModels, TaggedModel } from "./types"

type ScanConfig<T extends TaggedModel> = {
  db: DynamoDB.DocumentClient
  table: Table
  jayz?: JayZ
  consistentRead?: boolean
}

/** Builds and executes parameters for a DynamoDB Scan operation */
export class ScanBuilder<T extends TaggedModel> extends QueryExpressionBuilder<
  T
> {
  private modelTags: string[] = this.config.table.getModelTags()

  constructor(private config: ScanConfig<T>) {
    super()
  }

  async exec(): Promise<GroupedModels<T>> {
    const iterator = pagedIterator<DocumentClient.ScanInput, T>(
      {},
      (options) => this.buildScan(options),
      (input) => this.config.db.scan(input).promise(),
      this.config.jayz
    )

    return groupAllPages(iterator, this.modelTags)
  }

  async *iterator(options: IteratorOptions = {}): PaginatedQueryResults<T> {
    const iterator = pagedIterator<DocumentClient.ScanInput, T>(
      options,
      (options) => this.buildScan(options),
      (input) => this.config.db.scan(input).promise(),
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

  private buildScan(
    options: IteratorOptions
  ): DynamoDB.DocumentClient.ScanInput {
    const { table, consistentRead } = this.config
    const { expression, attributeNames, attributeValues } = this.build()
    const filterExp = expression !== "" ? expression : undefined

    const includeAttributeNames = filterExp !== undefined
    const includeAttributeValues =
      filterExp !== undefined && Object.values(attributeValues).length > 0

    return {
      TableName: table.tableName,
      ConsistentRead: consistentRead,
      ExpressionAttributeNames: includeAttributeNames
        ? attributeNames
        : undefined,
      ExpressionAttributeValues: includeAttributeValues
        ? attributeValues
        : undefined,
      FilterExpression: filterExp,
      ExclusiveStartKey: options.cursor,
      Limit: options.pageSize,
    }
  }
}
