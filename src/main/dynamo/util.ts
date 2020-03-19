export function toJSON<T>(item: { [key: string]: any }): T {
  delete item.pk
  delete item.sk
  return item as T
}
