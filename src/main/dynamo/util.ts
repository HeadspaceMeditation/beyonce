import { EncryptedJayZItem, JayZ } from "@ginger.io/jay-z"
import { NativeAttributeValue } from "@aws-sdk/util-dynamodb"

export type MaybeEncryptedItem<T> = EncryptedJayZItem<T & Record<string, string>, string> | (T & Record<string, string>)

export async function encryptOrPassThroughItem<T extends Record<string, any>>(
  jayz: JayZ | undefined,
  item: T,
  encryptionBlacklist: Set<string>
): Promise<MaybeEncryptedItem<T>> {
  if (jayz !== undefined) {
    const fieldsToEncrypt = Object.keys(item).filter((_) => !encryptionBlacklist.has(_))

    await jayz.ready
    return jayz.encryptItem({
      item,
      fieldsToEncrypt
    })
  } else {
    return item
  }
}

export async function decryptOrPassThroughItem(
  jayz: JayZ | undefined,
  item: Record<string, any>
): Promise<{ [key: string]: any }> {
  if (jayz !== undefined) {
    await jayz.ready
    return jayz.decryptItem(item as EncryptedJayZItem<any, any>)
  } else {
    return formatDynamoDBItem(item)
  }
}

/**
 * The DynamoDB v3 lib returns items with values that are UInt8Array instead of Buffer, so this function
 * converts those values to Buffers.
 */
export function formatDynamoDBItem<T extends Record<string, NativeAttributeValue>>(
  item: T
): T {
  const formattedItem: Record<string, NativeAttributeValue> = {}

  Object.entries(item).forEach(([key, value]) => {
    if (value instanceof Uint8Array) {
      formattedItem[key] = Buffer.from(value)
    } else {
      formattedItem[key] = value
    }
  })

  return formattedItem as T
}
