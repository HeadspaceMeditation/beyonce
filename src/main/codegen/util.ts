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

export function formatKeyComponent(component: string): string {
  return `"${component.replace("$", "")}"`
}
