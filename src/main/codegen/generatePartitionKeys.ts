import { Model, Table } from "./types"

export function generatePartitionKeys(table: Table): string {
  const modelsByPartition = groupBy(table.models, "partition")

  const partitions = modelsByPartition.map(([partition, models]) =>
    generatePartitionKey(partition, models, table.partitions)
  )

  return `
      pk: {
        ${partitions.join("\n,")}
      }
    `
}

function generatePartitionKey(
  partition: string,
  models: Model[],
  partitionKeys: { [partition: string]: string[] }
): string {
  const modelNames = models.map(_ => _.name)
  const keyParts = partitionKeys[partition]

  const inputFields: string[] = []
  const parts: string[] = []

  keyParts.forEach(part => {
    if (part.startsWith("_.")) {
      inputFields.push(part.replace("_.", ""))
      parts.push(part)
    } else {
      parts.push(`"${part}"`)
    }
  })

  const inputType = inputFields.map(_ => `${_}: string`).join(",")
  const modelType = modelNames.join(" | ")
  const keyComponents = parts.join(", ")
  return `${partition}: key<{${inputType}}, ${modelType}>(_ => [${keyComponents}])`
}

function groupBy<T extends { [key: string]: any }, U extends keyof T>(
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
