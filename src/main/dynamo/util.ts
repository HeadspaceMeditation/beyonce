import { EncryptedJayZItem, JayZ } from "@ginger.io/jay-z"

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
    return item
  }
}
