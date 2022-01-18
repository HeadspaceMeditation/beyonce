import { NativeAttributeValue } from "@aws-sdk/util-dynamodb"
import { JayZ } from "@ginger.io/jay-z"
import { DocumentClient } from "aws-sdk/clients/dynamodb"
import { CompositeError } from "../../CompositeError"
import { groupModelsByType } from "../groupModelsByType"
import { GroupedModels, TaggedModel } from "../types"
import { decryptOrPassThroughItem } from "../util"
import { InternalIteratorOptions } from "./types"

export type RawDynamoDBPage = {
  LastEvaluatedKey?: DocumentClient.Key
  Items?: DocumentClient.ItemList
}

export type PageResults<T extends TaggedModel> = {
  items: T[]
  errors: Error[]
  lastEvaluatedKey?: { [key: string]: NativeAttributeValue }
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

    results.push(...items)
  }

  return groupModelsByType(results, modelTags)
}

export async function* pagedIterator<T, U extends TaggedModel>(
  options: InternalIteratorOptions,
  buildOperation: (opts: InternalIteratorOptions) => T,
  executeOperation: (op: T) => Promise<RawDynamoDBPage>,
  jayz?: JayZ
): AsyncGenerator<PageResults<U>, PageResults<U>> {
  let pendingOperation: T | undefined = buildOperation(options)
  let lastEvaluatedKey = options.lastEvaluatedKey

  while (pendingOperation !== undefined) {
    const items: U[] = []
    const errors: Error[] = []
    try {
      const response = await executeOperation(pendingOperation)

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
          errors.push(error as Error)
        }
      })

      yield { items, lastEvaluatedKey, errors }
    } catch (error) {
      errors.push(error as Error)
      yield { items: [], lastEvaluatedKey, errors }
    }
  }

  return { items: [], errors: [], lastEvaluatedKey: undefined }
}
