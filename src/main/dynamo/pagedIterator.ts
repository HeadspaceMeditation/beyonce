import { JayZ } from "@ginger.io/jay-z"
import { DynamoDB } from "aws-sdk"
import { DocumentClient } from "aws-sdk/clients/dynamodb"
import { groupModelsByType } from "./groupModelsByType"
import { GroupedModels, TaggedModel } from "./types"
import { decryptOrPassThroughItems, toJSON } from "./util"

export type Cursor = Record<string, any>

export type IteratorOptions = {
  cursor?: Cursor
  pageSize?: number
}

export type RawDynamoDBPage = {
  LastEvaluatedKey?: DocumentClient.Key
  Items?: DocumentClient.ItemList
}

export type PageResults<T extends TaggedModel> = {
  items: T[]
  error?: Error
  lastEvaluatedKey?: DynamoDB.DocumentClient.Key
}

export type PaginatedQueryResults<T extends TaggedModel> = AsyncGenerator<
  QueryResults<T>,
  QueryResults<T>
>

export type QueryResults<T extends TaggedModel> = {
  items: GroupedModels<T>
  errors?: Error[]
  cursor?: Cursor
}

export async function groupAllPages<T extends TaggedModel>(
  iterator: AsyncGenerator<PageResults<T>, PageResults<T>>,
  modelTags: string[]
): Promise<GroupedModels<T>> {
  const results: T[] = []
  for await (const { items, error } of iterator) {
    results.push(...items)
    if (error) {
      throw error
    }
  }

  return groupModelsByType(results, modelTags)
}

export async function* pagedIterator<T, U extends TaggedModel>(
  options: IteratorOptions,
  buildOperation: (opts: IteratorOptions) => T,
  executeOperation: (op: T) => Promise<RawDynamoDBPage>,
  jayz?: JayZ
): AsyncGenerator<PageResults<U>, PageResults<U>> {
  let pendingOperation: T | undefined = buildOperation(options)
  let cursor: Cursor | undefined

  while (pendingOperation !== undefined) {
    try {
      const response: DynamoDB.DocumentClient.QueryOutput = await executeOperation(
        pendingOperation
      )

      if (response.LastEvaluatedKey !== undefined) {
        cursor = response.LastEvaluatedKey
        pendingOperation = buildOperation({ ...options, cursor })
      } else {
        pendingOperation = undefined
      }

      const maybeDecryptedItems = await decryptOrPassThroughItems(
        jayz,
        response.Items || []
      )

      const items = maybeDecryptedItems.map((item) => toJSON<U>(item))
      yield { items, lastEvaluatedKey: cursor }
    } catch (error) {
      yield { items: [], lastEvaluatedKey: cursor, error }
    }
  }

  return { items: [], lastEvaluatedKey: undefined }
}
