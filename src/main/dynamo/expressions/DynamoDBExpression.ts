import { NativeAttributeValue } from "@aws-sdk/util-dynamodb"

export interface DynamoDBExpression {
  expression: string
  attributeNames: { [key: string]: string }
  attributeValues: { [key: string]: NativeAttributeValue }
}
