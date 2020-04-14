import { Table } from "./types"

export function generateTables(tables: Table[]): string {
  const tableCode = tables.map((table) => {
    const encryptionBlacklist = generateEncryptionBlacklistParams(table)
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

function generateEncryptionBlacklistParams(table: Table): string {
  const encryptionBlacklistSet = new Set()

  const models = table.partitions.flatMap(({ models }) => models)

  models.forEach((model) => {
    const [, pk] = model.keys.partitionKey
    const [, sk] = model.keys.sortKey
    encryptionBlacklistSet.add(pk.replace("$", ""))
    encryptionBlacklistSet.add(sk.replace("$", ""))
  })

  table.gsis.forEach(({ name, partitionKey, sortKey })=>{
    encryptionBlacklistSet.add(partitionKey.replace("$", ""))
    encryptionBlacklistSet.add(sortKey.replace("$", ""))
  })

  return JSON.stringify(Array.from(encryptionBlacklistSet))
}
