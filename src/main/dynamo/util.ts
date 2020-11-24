import { EncryptedJayZItem, JayZ } from "@ginger.io/jay-z"

export type MaybeEncryptedItems<T> =
  | EncryptedJayZItem<T & Record<string, string>, string>
  | (T & Record<string, string>)

export function toJSON<T>(item: { [key: string]: any }): T {
  return item as T
}

export async function encryptOrPassThroughItems<T extends Record<string, any>>(
  jayz: JayZ | undefined,
  items: T[],
  encryptionBlacklist: Set<string>
): Promise<MaybeEncryptedItems<T>[]> {
  if (jayz !== undefined) {
    const itemsToEncrypt = items.map((item) => {
      const fieldsToEncrypt = Object.keys(item).filter(
        (_) => !encryptionBlacklist.has(_)
      )

      return {
        item,
        fieldsToEncrypt,
      }
    })

    return jayz.encryptItems(itemsToEncrypt)
  } else {
    return items
  }
}

export async function decryptOrPassThroughItems(
  jayz: JayZ | undefined,
  items: Record<string, any>[]
): Promise<{ [key: string]: any }[]> {
  if (jayz !== undefined) {
    return jayz.decryptItems(items as EncryptedJayZItem<any, any>[])
  } else {
    return items
  }
}
