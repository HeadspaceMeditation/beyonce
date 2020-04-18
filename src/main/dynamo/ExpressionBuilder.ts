import { DynamoDB } from "aws-sdk"
import { KeysOf } from "../typeUtils"
import { TaggedModel } from "./types"

export type Operator = "=" | "<>" | "<" | "<=" | ">" | ">="

export type DynamoDBExpression = {
  expression: DynamoDB.DocumentClient.ConditionExpression
  attributeNames: DynamoDB.DocumentClient.ExpressionAttributeNameMap
  attributeValues: DynamoDB.DocumentClient.ExpressionAttributeValueMap
}

/** Builds and executes parameters for a DynamoDB Query operation */
export class ExpressionBuilder<T extends TaggedModel> {
  private statements: string[] = []
  private attributeNames = new Attributes()
  private attributeValues = new Variables()

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
    const placeholder = this.addAttributeName(name)
    this.statements.push(`attribute_exists(${placeholder})`)
    return this
  }

  attributeNotExists(name: KeysOf<T>): this {
    const placeholder = this.addAttributeName(name)
    this.statements.push(`attribute_not_exists(${placeholder})`)
    return this
  }

  orAttributeExists(name: KeysOf<T>): this {
    const placeholder = this.addAttributeName(name)
    this.statements.push(`OR attribute_exists(${placeholder})`)
    return this
  }

  orAttributeNotExists(name: KeysOf<T>): this {
    const placeholder = this.addAttributeName(name)
    this.statements.push(`OR attribute_not_exists(${placeholder})`)
    return this
  }

  andAttributeExists(name: KeysOf<T>): this {
    const placeholder = this.addAttributeName(name)
    this.statements.push(`AND attribute_exists(${placeholder})`)
    return this
  }

  andAttributeNotExists(name: KeysOf<T>): this {
    const placeholder = this.addAttributeName(name)
    this.statements.push(`AND attribute_not_exists(${placeholder})`)
    return this
  }

  protected addAttributeName(name: string): string {
    return this.attributeNames.add(name)
  }
  protected addAttributeValue(name: string, value: any): string {
    return this.attributeValues.add(name, value)
  }

  private addCondition(params: {
    attribute: string
    value: any
    operator: Operator
    booleanOperator?: "OR" | "AND"
  }): void {
    const attributePlaceholder = this.addAttributeName(params.attribute)
    const valuePlaceholder = this.addAttributeValue(
      params.attribute,
      params.value
    )
    const expression = []

    if (params.booleanOperator !== undefined) {
      expression.push(params.booleanOperator)
    }

    expression.push(attributePlaceholder, params.operator, valuePlaceholder)
    this.statements.push(expression.join(" "))
  }

  build(): DynamoDBExpression {
    const expression = this.statements.join(" ")
    const attributeNames = this.attributeNames.getSubstitutions()
    const attributeValues = this.attributeValues.getSubstitutions()
    return {
      expression,
      attributeNames,
      attributeValues,
    }
  }
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
