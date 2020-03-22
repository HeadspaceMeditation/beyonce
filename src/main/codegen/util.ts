export function groupBy<T extends { [key: string]: any }, U extends keyof T>(
  data: T[],
  key: U
): [string, T[]][] {
  const groupedItems: { [key: string]: T[] } = {}

  data.forEach(item => {
    groupedItems[item[key]] = groupedItems[item[key]] || []
    groupedItems[item[key]].push(item)
  })

  return Object.entries(groupedItems)
}

export function intersection<T>(a: T[], b: T[]): T[] {
  const set = new Set(a)
  return b.filter(_ => set.has(_))
}
