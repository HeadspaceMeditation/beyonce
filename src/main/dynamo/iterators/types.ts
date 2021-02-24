import { DocumentClient } from "aws-sdk/clients/dynamodb"
import { GroupedModels, TaggedModel } from "../types"

export type Cursor = string

/** Iterator related options exposed to the caller facing API */
export interface IteratorOptions {
  cursor?: Cursor
  pageSize?: number
}

/** Iterator options intended for internal use (within this library) */
export interface InternalIteratorOptions {
  lastEvaluatedKey: DocumentClient.Key | undefined
  pageSize?: number
}

export interface IteratorResults<T extends TaggedModel> {
  items: GroupedModels<T>
  errors: Error[]
  cursor?: Cursor
}

export type PaginatedIteratorResults<T extends TaggedModel> = AsyncGenerator<
  IteratorResults<T>,
  IteratorResults<T>
>
