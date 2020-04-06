import { Model, Partition } from "./types"

export function generatePartitions(partitions: Partition[]): string {
  const generatedPartitions = partitions.map(({ tableName, name, models }) =>
    generatePartition(tableName, name, models)
  )

  return generatedPartitions.join("\n")
}

function generatePartition(
  tableName: string,
  partitionName: string,
  models: Model[]
): string {
  const modelNames = models.map(({ name }) => `${name}Model`)
  return `export const ${partitionName}Partition = ${tableName}Table.partition([${modelNames.join(
    ", "
  )}])`
}
