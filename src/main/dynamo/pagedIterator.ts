import { JayZ } from "@ginger.io/jay-z"
import { DynamoDB } from "aws-sdk"
import { DocumentClient } from "aws-sdk/clients/dynamodb"
import { CompositeError } from "../CompositeError"
import { groupModelsByType } from "./groupModelsByType"
import { GroupedModels, TaggedModel } from "./types"
import { decryptOrPassThroughItem, toJSON } from "./util"

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
  errors: Error[]
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
  for await (const { items, errors } of iterator) {
    if (errors.length > 0) {
      throw new CompositeError(
        "Error(s) encountered trying to process interator page",
        errors
      )
    }

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
  let cursor: Cursor | undefined

  while (pendingOperation !== undefined) {
    const items: U[] = []
    const errors: Error[] = []
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

      const itemsToDecrypt = response.Items ?? []

      const itemPromises = itemsToDecrypt.map(async (item) => {
        try {
          const maybeDecryptedItem = await decryptOrPassThroughItem(jayz, item)
          items.push(toJSON<U>(maybeDecryptedItem))
        } catch (error) {
          errors.push(error)
        }
      })

      await Promise.all(itemPromises)
      yield { items, lastEvaluatedKey: cursor, errors }
    } catch (error) {
      errors.push(error)
      yield { items: [], lastEvaluatedKey: cursor, errors }
    }
  }

  return { items: [], errors: [], lastEvaluatedKey: undefined }
}
