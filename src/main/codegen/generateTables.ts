import { Table } from "./types"

export function generateTables(tables: Table[]): string {
  const tableCode = tables.map((table) => {
    return `
      export const ${table.name}Table = new Table({
          name: "${table.name}",
          delimiter: "${table.delimiter}",
          partitionKeyName: "${table.partitionKeyName}",
          sortKeyName: "${table.sortKeyName}",
      })
    `
  })

  return tableCode.join("\n\n")
}
