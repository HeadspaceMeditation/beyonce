import { DynamoDB } from "aws-sdk"
import { toJSON } from "./util"
import { KeysOf } from "main/typeUtils"

type Operator = "=" | "<>" | "<" | "<=" | ">" | ">="

/** Builds and executes parameters for a DynamoDB Query operation */
export class QueryBuilder<T> {
  private filterExp: string[] = []
  private filterValues: { [key: string]: any } = {}

  constructor(
    private db: DynamoDB.DocumentClient,
    private tableName: string,
    private pk: string
  ) {}

  where(attribute: KeysOf<T>, operator: Operator, value: any): this {
    return this.addCondition(`${attribute} ${operator} :${attribute}`, {
      [`:${attribute}`]: value
    })
  }

  or(attribute: KeysOf<T>, operator: Operator, value: any): this {
    return this.addCondition(`OR ${attribute} ${operator} :${attribute}`, {
      [`:${attribute}`]: value
    })
  }

  and(attribute: KeysOf<T>, operator: Operator, value: any): this {
    return this.addCondition(`AND ${attribute} ${operator} :${attribute}`, {
      [`:${attribute}`]: value
    })
  }

  attributeExists(name: KeysOf<T>): this {
    this.filterExp.push(`attribute_exists(${name})`)
    return this
  }

  attributeNotExists(name: KeysOf<T>): this {
    this.filterExp.push(`attribute_not_exists(${name})`)
    return this
  }

  async exec(): Promise<T[]> {
    const { Items: items } = await this.db.query(this.build()).promise()

    if (items !== undefined) {
      return items.map(_ => toJSON<T>(_))
    } else {
      return []
    }
  }

  private addCondition(exp: string, values: { [key: string]: any }): this {
    this.filterExp.push(exp)
    this.filterValues = { ...this.filterValues, ...values }
    return this
  }

  private build(): DynamoDB.DocumentClient.QueryInput {
    const filter = this.filterExp.join(" ")
    return {
      TableName: this.tableName,
      KeyConditionExpression: "pk = :pk",
      ExpressionAttributeValues: {
        ...this.filterValues,
        ":pk": this.pk
      },
      FilterExpression: filter !== "" ? filter : undefined
    }
  }
}
