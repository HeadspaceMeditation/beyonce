import { generateGSIs } from "./generateGSIs"
import { generatePartitionKeys } from "./generatePartitionKeys"
import { generateSortKeys } from "./generateSortKeys"
import { Table } from "./types"

export function generateTables(tables: Table[]): string {
  const tableCode = tables.map(table => {
    const partitionKeys = generatePartitionKeys(table)
    const sortKeys = generateSortKeys(table)
    const gsis = generateGSIs(table)
    const encryptionBlacklist = generateEncryptionBlacklist(table)
    return `
      export const ${table.name}Table = {
          name: "${table.name}",
          encryptionBlacklist: ${JSON.stringify(encryptionBlacklist)},
          ${partitionKeys},
          ${sortKeys},
          ${gsis}
      }
    `
  })

  return tableCode.join("\n\n")
}

function generateEncryptionBlacklist(table: Table): string[] {
  const blacklist = ["pk", "sk", "model", "__jayz__metadata"]

  table.gsis.forEach(({ partition, sort }) => {
    blacklist.push(partition)
    blacklist.push(sort)
  })

  return Array.from(new Set(blacklist))
}
