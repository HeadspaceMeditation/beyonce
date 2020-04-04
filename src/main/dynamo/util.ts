import { EncryptedJayZItem } from "@ginger.io/jay-z"
import { JayZConfig } from "./JayZConfig"
import { Key } from "./Key"

export type ItemAndKey<T> = {
  key: PartitionAndSortKey<any, T>
  item: T
}

export type PartitionAndSortKey<T, U> = {
  partition: Key<T>
  sort: Key<U>
}

export type MaybeEncryptedItems<T> =
  | EncryptedJayZItem<
      T & {
        [key: string]: string
      },
      string
    >
  | (T & { [key: string]: string })

export function toJSON<T>(item: { [key: string]: any }): T {
  delete item.pk
  delete item.sk
  return item as T
}

export async function encryptOrPassThroughItems<T>(
  jayz: JayZConfig | undefined,
  item: T & { [key: string]: string }
): Promise<MaybeEncryptedItems<T>> {
  if (jayz !== undefined) {
    const fieldsToEncrypt = Object.keys(item).filter(
      (_) => !jayz.encryptionBlacklist.has(_)
    )
    return jayz.client.encryptItem(item, fieldsToEncrypt)
  } else {
    return item
  }
}

export async function decryptOrPassThroughItem(
  jayz: JayZConfig | undefined,
  item: {
    [key: string]: any
  }
): Promise<{ [key: string]: any }> {
  if (jayz !== undefined) {
    return jayz.client.decryptItem(item as EncryptedJayZItem<any, any>)
  } else {
    return item
  }
}
