import { DynamoDB } from "aws-sdk"
import { JayZ } from "@ginger.io/jay-z"
import { KeysOf } from "../typeUtils"
import { Key } from "./Key"
import { Model } from "./Model"
import { decryptOrPassThroughItem, toJSON } from "./util"

type Operator = "=" | "<>" | "<" | "<=" | ">" | ">="

/** Builds and executes parameters for a DynamoDB Query operation */
export class QueryBuilder<T extends Model> {
  private filterExp: string[] = []
  private filterValues: { [key: string]: any } = {}

  constructor(
    private db: DynamoDB.DocumentClient,
    private tableName: string,
    private pk: Key<T>,
    private jayz?: JayZ
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
      const jsonItems = items.map(async _ => {
        const item = await decryptOrPassThroughItem(this.jayz, _)
        return toJSON<T>(item)
      })

      return Promise.all(jsonItems)
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
      KeyConditionExpression: `${this.pk.name} = :partitionKey`,
      ExpressionAttributeValues: {
        ...this.filterValues,
        ":partitionKey": this.pk.value
      },
      FilterExpression: filter !== "" ? filter : undefined
    }
  }
}
