import { JayZ } from "@ginger.io/jay-z"
import { QueryCommandOutput } from "@aws-sdk/lib-dynamodb"
import { CompositeError } from "../../CompositeError"
import { groupModelsByType } from "../groupModelsByType"
import { GroupedModels, Key, TaggedModel } from "../types"
import { decryptOrPassThroughItem, formatDynamoDBItem } from "../util"
import { InternalIteratorOptions } from "./types"

export type PageResults<T extends TaggedModel> = {
  items: T[]
  errors: Error[]
  lastEvaluatedKey?: Key
}

export async function groupAllPages<T extends TaggedModel>(
  iterator: AsyncGenerator<PageResults<T>, PageResults<T>>,
  modelTags: string[]
): Promise<GroupedModels<T>> {
  const results: T[] = []
  for await (const { items, errors } of iterator) {
    if (errors.length > 0) {
      throw new CompositeError("Error(s) encountered trying to process interator page", errors)
    }
    const formattedItems = items.map(item => formatDynamoDBItem<T>(item))
    results.push(...formattedItems)
  }

  return groupModelsByType(results, modelTags)
}

export async function* pagedIterator<T, U extends TaggedModel>(
  options: InternalIteratorOptions,
  buildOperation: (opts: InternalIteratorOptions) => T,
  executeOperation: (op: T) => Promise<QueryCommandOutput>,
  jayz?: JayZ
): AsyncGenerator<PageResults<U>, PageResults<U>> {
  let pendingOperation: T | undefined = buildOperation(options)
  let lastEvaluatedKey = options.lastEvaluatedKey

  while (pendingOperation !== undefined) {
    const items: U[] = []
    const errors: Error[] = []
    try {
      const response: QueryCommandOutput = await executeOperation(pendingOperation)

      if (response.LastEvaluatedKey !== undefined) {
        lastEvaluatedKey = response.LastEvaluatedKey
        pendingOperation = buildOperation({ ...options, lastEvaluatedKey })
      } else {
        lastEvaluatedKey = undefined
        pendingOperation = undefined
      }

      const itemsToDecrypt = response.Items ?? []
      const itemPromises = itemsToDecrypt.map(async (item) => {
        try {
          const maybeDecryptedItem = await decryptOrPassThroughItem(jayz, item)
          return { item: maybeDecryptedItem as U }
        } catch (error) {
          return { error }
        }
      })

      const results = await Promise.all(itemPromises)
      results.forEach(({ item, error }) => {
        if (item) {
          items.push(item)
        } else if (error) {
          errors.push(error)
        }
      })

      yield { items, lastEvaluatedKey, errors }
    } catch (error) {
      errors.push(error)
      yield { items: [], lastEvaluatedKey, errors }
    }
  }

  return { items: [], errors: [], lastEvaluatedKey: undefined }
}
