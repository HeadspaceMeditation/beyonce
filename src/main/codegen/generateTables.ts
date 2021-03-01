import { Table } from "./types"
import { formatKeyComponent } from "./util"

export function generateTables(tables: Table[]): string {
  const tableCode = tables.map((table) => {
    const encryptionBlacklist = generateEncryptionBlacklist(table)
    return `
      export const ${table.name}Table = new Table({
          name: "${table.name}",
          partitionKeyName: "${table.partitionKeyName}",
          sortKeyName: "${table.sortKeyName}",
          encryptionBlacklist: ${encryptionBlacklist}
      })
    `
  })

  return tableCode.join("\n\n")
}

function generateEncryptionBlacklist(table: Table): string {
  const encryptionBlacklistSet = new Set<string>()

  table.partitions
    .flatMap((_) => _.models)
    .forEach((model) => {
      const [, ...pkComponents] = model.keys.partitionKey
      const [, ...skComponents] = model.keys.sortKey

      pkComponents.map(formatKeyComponent).forEach((_) => encryptionBlacklistSet.add(_))

      skComponents.map(formatKeyComponent).forEach((_) => encryptionBlacklistSet.add(_))
    })

  table.gsis.forEach(({ partitionKey, sortKey }) => {
    encryptionBlacklistSet.add(formatKeyComponent(partitionKey))
    encryptionBlacklistSet.add(formatKeyComponent(sortKey))
  })

  return `[${Array.from(encryptionBlacklistSet).join(", ")}]`
}
