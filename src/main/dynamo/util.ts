import { ItemWithEncryptedFields, JayZ } from "@ginger.io/jay-z"
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

export async function encryptOrPassThroughItem<
  T extends Model,
  U extends Model
>(
  jayz: JayZ | undefined,
  keys: PartitionAndSortKey<T, U>,
  item: U & { [key: string]: string }
): Promise<
  | ItemWithEncryptedFields<
      U & {
        [key: string]: string
      },
      string
    >
  | (U & { [key: string]: string })
> {
  if (jayz !== undefined) {
    const fieldsToEncrypt = Object.keys(item).filter(
      _ => _ !== keys.partition.name && _ !== keys.sort.name
    )
    return jayz.encryptItem(item, fieldsToEncrypt)
  } else {
    return item
  }
}

export async function decryptOrPassThroughItem(
  jayz: JayZ | undefined,
  item: {
    [key: string]: any
  }
): Promise<{ [key: string]: any }> {
  if (jayz !== undefined) {
    return jayz.decryptItem(item as ItemWithEncryptedFields<any, any>)
  } else {
    return item
  }
}
