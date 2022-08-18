export type DynamoDBExpression = {
  expression: string
  attributeNames: Record<string, string>
  attributeValues: Record<string, string>
}
