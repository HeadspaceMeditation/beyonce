import { generatePartitionKeys } from "./generatePartitionKeys"
import { generateSortKeys } from "./generateSortKeys"
import { Table } from "./types"

export function generateTables(tables: Table[]): string {
  const tableCode = tables.map(table => {
    const partitionKeys = generatePartitionKeys(table)
    const sortKeys = generateSortKeys(table)
    return `
      export const ${table.name}Table = {
          name: "${table.name}",
          ${partitionKeys},
          ${sortKeys}
      }
    `
  })

  return tableCode.join("\n\n")
}
