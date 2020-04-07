import { EncryptedJayZItem } from "@ginger.io/jay-z"
import { JayZConfig } from "./JayZConfig"

export type MaybeEncryptedItems<T> =
  | EncryptedJayZItem<
      T & {
        [key: string]: string
      },
      string
    >
  | (T & { [key: string]: string })

export function toJSON<T>(item: { [key: string]: any }): T {
  return item as T
}

export async function encryptOrPassThroughItems<T extends Record<string, any>>(
  jayz: JayZConfig | undefined,
  item: T
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
  item: Record<string, any>
): Promise<{ [key: string]: any }> {
  if (jayz !== undefined) {
    return jayz.client.decryptItem(item as EncryptedJayZItem<any, any>)
  } else {
    return item
  }
}
