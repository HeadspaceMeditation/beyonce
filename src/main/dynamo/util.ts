import { ItemWithEncryptedFields, JayZ } from "@ginger.io/jay-z"
import { JayZConfig } from "./JayZConfig"
import { Key } from "./Key"
import { Model } from "./Model"

export type PartitionAndSortKey<T extends Model, U extends Model> = {
  partition: Key<T>
  sort: Key<U>
}

export function toJSON<T>(item: { [key: string]: any }): T {
  delete item.pk
  delete item.sk
  return item as T
}

export async function encryptOrPassThroughItem<T extends Model>(
  jayz: JayZConfig | undefined,
  item: T & { [key: string]: string }
): Promise<
  | ItemWithEncryptedFields<
      T & {
        [key: string]: string
      },
      string
    >
  | (T & { [key: string]: string })
> {
  if (jayz !== undefined) {
    const fieldsToEncrypt = Object.keys(item).filter(
      _ => !jayz.dontEncrypt.has(_)
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
    return jayz.client.decryptItem(item as ItemWithEncryptedFields<any, any>)
  } else {
    return item
  }
}
