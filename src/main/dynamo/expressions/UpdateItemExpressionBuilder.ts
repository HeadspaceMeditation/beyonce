import { PartitionAndSortKey } from "../keys"
import { TaggedModel } from "../types"
import { Attributes } from "./Attributes"
import { DynamoDBExpression } from "./DynamoDBExpression"
import { Variables } from "./Variables"

export class UpdateItemExpressionBuilder {
  private attributeNames = new Attributes()
  private attributeValues = new Variables()
  private setStatements: string[] = []
  private removeStatements: string[] = []

  set(attributePath: string[], value: string): this {
    const attrPlaceholders = attributePath.map((attr) => this.addAttributeName(attr))
    const valuePlaceholder = this.addAttributeValue(value)

    this.setStatements.push(`${attrPlaceholders.join(".")} = ${valuePlaceholder}`)

    return this
  }

  remove(attributePath: string[]): this {
    const attrPlaceholders = attributePath.map((attr) => this.addAttributeName(attr))

    this.removeStatements.push(attrPlaceholders.join("."))
    return this
  }

  buildKeyConditionExpression<T extends TaggedModel>(key: PartitionAndSortKey<T>): string {
    const pkPlaceholder = this.addAttributeName(key.partitionKeyName)
    const pkValuePlaceholder = this.addAttributeValue(key.partitionKey)
    const keyConditionExpression = [`${pkPlaceholder} = ${pkValuePlaceholder}`]

    const { sortKeyName, sortKey } = key
    const skPlaceholder = this.addAttributeName(sortKeyName)
    const skValuePlaceholder = this.addAttributeValue(sortKey)
    keyConditionExpression.push(`begins_with(${skPlaceholder}, ${skValuePlaceholder})`)

    return keyConditionExpression.join(" AND ")
  }

  build(): DynamoDBExpression {
    const expression: string[] = []

    if (this.setStatements.length > 0) {
      expression.push("SET", this.setStatements.join(", "))
    }

    if (this.removeStatements.length > 0) {
      expression.push("REMOVE", this.removeStatements.join(", "))
    }

    const attributeNames = this.attributeNames.getSubstitutions()
    const attributeValues = this.attributeValues.getSubstitutions()
    return {
      expression: expression.join(" "),
      attributeNames,
      attributeValues
    }
  }

  protected addAttributeName(name: string): string {
    return this.attributeNames.add(name)
  }
  protected addAttributeValue(value: any): string {
    return this.attributeValues.add(value)
  }
}
