import { DynamoDB } from "aws-sdk"

export type DynamoDBExpression = {
  expression: DynamoDB.DocumentClient.ConditionExpression
  attributeNames: DynamoDB.DocumentClient.ExpressionAttributeNameMap
  attributeValues: DynamoDB.DocumentClient.ExpressionAttributeValueMap
}
