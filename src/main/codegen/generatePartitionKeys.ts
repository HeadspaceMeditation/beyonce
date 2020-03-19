import { ModelSet } from "./types"

export function generatePartitionKeys(
  models: ModelSet,
  partitionKeys: { [partition: string]: string[] }
): string {
  const modelsByPartition = groupBy(models, "partition")
  const partitions = modelsByPartition.map(([partition, models]) =>
    generatePartitionKey(partition, models, partitionKeys)
  )
  return `
      export const PK = {
        ${partitions.join("\n,")}
      }
    `
}

function generatePartitionKey(
  partition: string,
  models: ModelSet,
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
  return `${partition}: new Key<${modelNames.join(
    " | "
  )}, {${inputType}}>(_ => [${parts.join(", ")}])`
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
