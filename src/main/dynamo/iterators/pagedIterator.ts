import { JayZ } from "@ginger.io/jay-z"
import { DynamoDB } from "aws-sdk"
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
  lastEvaluatedKey?: DynamoDB.DocumentClient.Key
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
      const response: DynamoDB.DocumentClient.QueryOutput = await executeOperation(pendingOperation)

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
          items.push(maybeDecryptedItem as U)
        } catch (error) {
          errors.push(error)
        }
      })

      await Promise.all(itemPromises)
      yield { items, lastEvaluatedKey, errors }
    } catch (error) {
      errors.push(error)
      yield { items: [], lastEvaluatedKey, errors }
    }
  }

  return { items: [], errors: [], lastEvaluatedKey: undefined }
}
