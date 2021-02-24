import { Cursor } from "aws-sdk/clients/cloudsearchdomain"
import { DocumentClient } from "aws-sdk/clients/dynamodb"
import { base64_variants, from_base64, to_base64 } from "libsodium-wrappers"
import { TextDecoder } from "util"
import { InternalIteratorOptions, IteratorOptions } from "./types"

export function toInternalIteratorOptions(
  options: IteratorOptions
): InternalIteratorOptions {
  return {
    lastEvaluatedKey: maybeDeserializeCursor(options.cursor),
    pageSize: options.pageSize
  }
}

export function maybeSerializeCursor(
  key?: DocumentClient.Key
): string | undefined {
  if (key) {
    return to_base64(JSON.stringify(key), base64_variants.ORIGINAL_NO_PADDING)
  }
}

export function maybeDeserializeCursor(
  cursor?: Cursor
): DocumentClient.Key | undefined {
  if (cursor) {
    const json = new TextDecoder().decode(
      from_base64(cursor, base64_variants.ORIGINAL_NO_PADDING)
    )
    return JSON.parse(json)
  }
}
