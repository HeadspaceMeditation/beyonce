import { DynamoDB } from "aws-sdk"
import { PartitionKey } from "./keys"
import { Table } from "./Table"
import { KeysOf } from "../typeUtils"
import { decryptOrPassThroughItem, toJSON } from "./util"
import { JayZ } from "@ginger.io/jay-z"

type Operator = "=" | "<>" | "<" | "<=" | ">" | ">="

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
export class QueryBuilder<T extends Record<string, any>> {
  private filterExp: string[] = []
  private attributes = new Attributes()
  private variables = new Variables()

  constructor(private config: TableQueryParams<T> | GSIQueryParams<T>) {}

  where(attribute: KeysOf<T>, operator: Operator, value: any): this {
    this.addCondition({ attribute, operator, value })
    return this
  }

  or(attribute: KeysOf<T>, operator: Operator, value: any): this {
    this.addCondition({ attribute, operator, value, booleanOperator: "OR" })
    return this
  }

  and(attribute: KeysOf<T>, operator: Operator, value: any): this {
    this.addCondition({ attribute, operator, value, booleanOperator: "AND" })
    return this
  }

  attributeExists(name: KeysOf<T>): this {
    const placeholder = this.attributes.add(name)
    this.filterExp.push(`attribute_exists(${placeholder})`)
    return this
  }

  attributeNotExists(name: KeysOf<T>): this {
    const placeholder = this.attributes.add(name)
    this.filterExp.push(`attribute_not_exists(${placeholder})`)
    return this
  }

  async exec(): Promise<T[]> {
    const { db } = this.config
    const items: DynamoDB.DocumentClient.ItemList = []
    let pendingQuery:
      | Promise<DynamoDB.DocumentClient.QueryOutput>
      | undefined = this.config.db.query(this.build()).promise()

    while (pendingQuery !== undefined) {
      const response: DynamoDB.DocumentClient.QueryOutput = await pendingQuery
      items.push(...(response.Items || []))

      if (response.LastEvaluatedKey !== undefined) {
        pendingQuery = db.query(this.build(response.LastEvaluatedKey)).promise()
      } else {
        pendingQuery = undefined
      }
    }

    const jsonItems = items.map(async (_) => {
      const item = await decryptOrPassThroughItem(this.config.jayz, _)
      return toJSON<T>(item)
    })

    return Promise.all(jsonItems)
  }

  private addCondition(params: {
    attribute: string
    value: any
    operator: Operator
    booleanOperator?: "OR" | "AND"
  }): void {
    const attributePlaceholder = this.attributes.add(params.attribute)
    const valuePlaceholder = this.variables.add(params.attribute, params.value)
    const expression = []

    if (params.booleanOperator !== undefined) {
      expression.push(params.booleanOperator)
    }

    expression.push(attributePlaceholder, params.operator, valuePlaceholder)
    this.filterExp.push(expression.join(" "))
  }

  private build(
    lastEvaluatedKey?: DynamoDB.DocumentClient.Key | undefined
  ): DynamoDB.DocumentClient.QueryInput {
    const filter = this.filterExp.join(" ")
    const filterExp = filter !== "" ? filter : undefined
    const attributes = this.attributes.getSubstitutions()
    const variables = this.variables.getSubstitutions()

    if (isTableQuery(this.config)) {
      const { table, pk } = this.config
      const pkPlaceholder = this.attributes.add(table.partitionKeyName)
      const pkValuePlaceholder = this.variables.add(
        table.partitionKeyName,
        pk.partitionKey
      )

      return {
        TableName: table.tableName,
        KeyConditionExpression: `${pkPlaceholder} = ${pkValuePlaceholder}`,
        ExpressionAttributeNames: attributes,
        ExpressionAttributeValues: variables,
        FilterExpression: filterExp,
        ExclusiveStartKey: lastEvaluatedKey,
      }
    } else {
      const { table, gsiPk } = this.config
      const pkPlaceholder = this.attributes.add(gsiPk.partitionKeyName)
      const pkValuePlaceholder = this.variables.add(
        gsiPk.partitionKeyName,
        gsiPk.partitionKey
      )

      return {
        TableName: table.tableName,
        IndexName: this.config.gsiName,
        KeyConditionExpression: `${pkPlaceholder} = ${pkValuePlaceholder}`,
        ExpressionAttributeNames: attributes,
        ExpressionAttributeValues: variables,
        FilterExpression: filterExp,
        ExclusiveStartKey: lastEvaluatedKey,
      }
    }
  }
}

function isTableQuery<T>(
  query: TableQueryParams<T> | GSIQueryParams<T>
): query is TableQueryParams<T> {
  return (query as any).pk !== undefined
}

class Attributes {
  private substitutions: { [key: string]: string } = {}

  add(attribute: string): string {
    const placeholder = `#${attribute}`
    this.substitutions[placeholder] = attribute
    return placeholder
  }

  getSubstitutions(): Readonly<{ [key: string]: string }> {
    return this.substitutions
  }
}

class Variables {
  private substitutions: { [key: string]: string } = {}

  add(name: string, value: any): string {
    const placeholder = `:${name}`
    this.substitutions[placeholder] = value
    return placeholder
  }

  getSubstitutions(): Readonly<{ [key: string]: string }> {
    return this.substitutions
  }
}
