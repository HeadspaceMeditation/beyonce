import { EncryptedJayZItem, JayZ } from "@ginger.io/jay-z"

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
  jayz: JayZ | undefined,
  item: T,
  encryptionBlacklist: Set<string>
): Promise<MaybeEncryptedItems<T>> {
  if (jayz !== undefined) {
    const fieldsToEncrypt = Object.keys(item).filter(
      (_) => !encryptionBlacklist.has(_)
    )
    return jayz.encryptItem(item, fieldsToEncrypt)
  } else {
    return item
  }
}

export async function decryptOrPassThroughItem(
  jayz: JayZ | undefined,
  item: Record<string, any>
): Promise<{ [key: string]: any }> {
  if (jayz !== undefined) {
    return jayz.decryptItem(item as EncryptedJayZItem<any, any>)
  } else {
    return item
  }
}
