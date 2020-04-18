import { JayZ } from "@ginger.io/jay-z"
import { DynamoDB } from "aws-sdk"
import { ExpressionBuilder } from "./ExpressionBuilder"
import { groupModelsByType } from "./groupModelsByType"
import { PartitionKey } from "./keys"
import { Table } from "./Table"
import { GroupedModels, TaggedModel } from "./types"
import { decryptOrPassThroughItem, toJSON } from "./util"

type TableQueryParams<T> = {
  db: DynamoDB.DocumentClient
  table: Table
  pk: PartitionKey<T>
  jayz?: JayZ
}

type GSIQueryParams<T> = {
  db: DynamoDB.DocumentClient
  table: Table
  gsiName: string
  gsiPk: PartitionKey<T>
  jayz?: JayZ
}

/** Builds and executes parameters for a DynamoDB Query operation */
export class QueryBuilder<T extends TaggedModel> extends ExpressionBuilder<T> {
  private scanIndexForward: boolean = true
  private limit?: number

  constructor(private config: TableQueryParams<T> | GSIQueryParams<T>) {
    super()
  }

  reverse(): this {
    this.scanIndexForward = false
    return this
  }

  maxRecordsToProcess(n: number): this {
    this.limit = n
    return this
  }

  async exec(): Promise<GroupedModels<T>> {
    const { db } = this.config
    const items: DynamoDB.DocumentClient.ItemList = []
    let pendingQuery:
      | Promise<DynamoDB.DocumentClient.QueryOutput>
      | undefined = this.config.db.query(this.buildQuery()).promise()

    while (pendingQuery !== undefined) {
      const response: DynamoDB.DocumentClient.QueryOutput = await pendingQuery
      items.push(...(response.Items || []))

      if (response.LastEvaluatedKey !== undefined && this.limit === undefined) {
        pendingQuery = db
          .query(this.buildQuery(response.LastEvaluatedKey))
          .promise()
      } else {
        pendingQuery = undefined
      }
    }

    const jsonItemPromises = items.map(async (_) => {
      const item = await decryptOrPassThroughItem(this.config.jayz, _)
      return toJSON<T>(item)
    })

    const jsonItems = await Promise.all(jsonItemPromises)
    return groupModelsByType(jsonItems)
  }

  private buildQuery(
    lastEvaluatedKey?: DynamoDB.DocumentClient.Key | undefined
  ): DynamoDB.DocumentClient.QueryInput {
    if (isTableQuery(this.config)) {
      const { table, pk } = this.config
      const pkPlaceholder = this.addAttributeName(table.partitionKeyName)
      const pkValuePlaceholder = this.addAttributeValue(
        table.partitionKeyName,
        pk.partitionKey
      )

      const { expression, attributeNames, attributeValues } = this.build()
      const filterExp = expression !== "" ? expression : undefined

      return {
        TableName: table.tableName,
        KeyConditionExpression: `${pkPlaceholder} = ${pkValuePlaceholder}`,
        ExpressionAttributeNames: attributeNames,
        ExpressionAttributeValues: attributeValues,
        FilterExpression: filterExp,
        ExclusiveStartKey: lastEvaluatedKey,
        ScanIndexForward: this.scanIndexForward,
        Limit: this.limit,
      }
    } else {
      const { table, gsiPk } = this.config
      const pkPlaceholder = this.addAttributeName(gsiPk.partitionKeyName)
      const pkValuePlaceholder = this.addAttributeValue(
        gsiPk.partitionKeyName,
        gsiPk.partitionKey
      )

      const { expression, attributeNames, attributeValues } = this.build()
      const filterExp = expression !== "" ? expression : undefined

      return {
        TableName: table.tableName,
        IndexName: this.config.gsiName,
        KeyConditionExpression: `${pkPlaceholder} = ${pkValuePlaceholder}`,
        ExpressionAttributeNames: attributeNames,
        ExpressionAttributeValues: attributeValues,
        FilterExpression: filterExp,
        ExclusiveStartKey: lastEvaluatedKey,
        ScanIndexForward: this.scanIndexForward,
        Limit: this.limit,
      }
    }
  }
}

function isTableQuery<T>(
  query: TableQueryParams<T> | GSIQueryParams<T>
): query is TableQueryParams<T> {
  return (query as any).pk !== undefined
}
