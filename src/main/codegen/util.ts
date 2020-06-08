export function groupBy<T extends { [key: string]: any }, U extends keyof T>(
  data: T[],
  key: U
): [string, T[]][] {
  const groupedItems: { [key: string]: T[] } = {}

  data.forEach((item) => {
    groupedItems[item[key]] = groupedItems[item[key]] || []
    groupedItems[item[key]].push(item)
  })

  return Object.entries(groupedItems)
}

export function replaceKeyDollar(key: string | string[]) {
  if (Array.isArray(key)) {
    return key.map((k) => k.replace("$", ""))
  }
  return key.replace("$", "")
}

export function buildKey(key: string | string[]) {
  const cleanKey = replaceKeyDollar(key);
  if (Array.isArray(cleanKey)) {
    const keys = cleanKey.map((k) => `"${k}"`).join(', ')
    return `[${keys}]`
  }
  return `"${cleanKey.replace("$", "")}"`
}

export function buildKeyArray(key: string | string[]) {
  const keyOrKeys = replaceKeyDollar(key)
  if (Array.isArray(keyOrKeys)) {
    return keyOrKeys
  }
  return [keyOrKeys]
}