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
  lastEvaluatedKey?: DynamoDB.DocumentClient.Key
}

export type PaginatedQueryResults<T extends TaggedModel> = AsyncGenerator<
  QueryResults<T>,
  QueryResults<T>
>

export type QueryResults<T extends TaggedModel> = {
  items: GroupedModels<T>
  cursor?: Cursor
}

export async function groupAllPages<T extends TaggedModel>(
  iterator: AsyncGenerator<PageResults<T>, PageResults<T>>,
  modelTags: string[]
): Promise<GroupedModels<T>> {
  const results: T[] = []
  for await (const { items } of iterator) {
    results.push(...items)
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

  while (pendingOperation !== undefined) {
    const response: DynamoDB.DocumentClient.QueryOutput = await executeOperation(
      pendingOperation
    )

    if (response.LastEvaluatedKey !== undefined) {
      pendingOperation = buildOperation({
        ...options,
        cursor: response.LastEvaluatedKey,
      })
    } else {
      pendingOperation = undefined
    }

    const maybeDecryptedItems = await decryptOrPassThroughItems(
      jayz,
      response.Items || []
    )

    const items = maybeDecryptedItems.map((item) => toJSON<U>(item))
    yield { items, lastEvaluatedKey: response.LastEvaluatedKey }
  }

  return { items: [] as U[], lastEvaluatedKey: undefined }
}
