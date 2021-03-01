import { JayZ } from "@ginger.io/jay-z"
import { DynamoDB } from "aws-sdk"
import { DocumentClient } from "aws-sdk/clients/dynamodb"
import { ready } from "libsodium-wrappers"
import { QueryExpressionBuilder } from "./expressions/QueryExpressionBuilder"
import { groupModelsByType } from "./groupModelsByType"
import { groupAllPages, pagedIterator } from "./iterators/pagedIterator"
import { InternalIteratorOptions, IteratorOptions, PaginatedIteratorResults } from "./iterators/types"
import { maybeSerializeCursor, toInternalIteratorOptions } from "./iterators/util"
import { Table } from "./Table"
import { GroupedModels, TaggedModel } from "./types"

interface ScanConfig<T extends TaggedModel> {
  db: DynamoDB.DocumentClient
  table: Table
  jayz?: JayZ
  consistentRead?: boolean
  parallel?: ParallelScanConfig
}

export interface ParallelScanConfig {
  segmentId: number // 0-indexed -- i.e. first segment id is 0, not 1
  totalSegments: number
}

/** Builds and executes parameters for a DynamoDB Scan operation */
export class ScanBuilder<T extends TaggedModel> extends QueryExpressionBuilder<T> {
  private modelTags: string[] = this.config.table.getModelTags()

  constructor(private config: ScanConfig<T>) {
    super()
  }

  async exec(): Promise<GroupedModels<T>> {
    const scanInput = this.createScanInput()
    const iterator = pagedIterator<DocumentClient.ScanInput, T>(
      { lastEvaluatedKey: undefined },
      ({ lastEvaluatedKey, pageSize }) => ({
        ...scanInput,
        ExclusiveStartKey: lastEvaluatedKey,
        Limit: pageSize
      }),
      (input) => this.config.db.scan(input).promise(),
      this.config.jayz
    )

    return groupAllPages(iterator, this.modelTags)
  }

  async *iterator(options: IteratorOptions = {}): PaginatedIteratorResults<T> {
    const iteratorOptions = toInternalIteratorOptions(options)
    const scanInput = this.createScanInput(iteratorOptions)
    const iterator = pagedIterator<DocumentClient.ScanInput, T>(
      iteratorOptions,
      ({ lastEvaluatedKey, pageSize }) => ({
        ...scanInput,
        ExclusiveStartKey: lastEvaluatedKey,
        Limit: pageSize
      }),
      (input) => this.config.db.scan(input).promise(),
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

  private createScanInput(iteratorOptions?: InternalIteratorOptions) {
    const { table, consistentRead, parallel } = this.config
    const { expression, attributeNames, attributeValues } = this.build()
    const filterExp = expression !== "" ? expression : undefined
    const includeAttributeNames = filterExp !== undefined
    const includeAttributeValues = filterExp !== undefined && Object.values(attributeValues).length > 0

    return {
      TableName: table.tableName,
      ConsistentRead: consistentRead,
      ExpressionAttributeNames: includeAttributeNames ? attributeNames : undefined,
      ExpressionAttributeValues: includeAttributeValues ? attributeValues : undefined,
      FilterExpression: filterExp,
      ExclusiveStartKey: iteratorOptions?.lastEvaluatedKey,
      Limit: iteratorOptions?.pageSize,
      Segment: parallel?.segmentId,
      TotalSegments: parallel?.totalSegments
    }
  }
}
