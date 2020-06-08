import { Table } from "./types"
import { buildKeyArray } from "./util"

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
      const [, pk] = model.keys.partitionKey
      const [, sk] = model.keys.sortKey

      const pks = buildKeyArray(model.keys.partitionKey[1])
      const sks = buildKeyArray(model.keys.sortKey[1])
      pks.forEach((key: string) => encryptionBlacklistSet.add(key))
      sks.forEach((key: string) => encryptionBlacklistSet.add(key))
    })

  table.gsis.forEach(({ name, partitionKey, sortKey }) => {
    const pk = buildKeyArray(partitionKey)
    const sk = buildKeyArray(sortKey)
    pk.forEach((key: string) => encryptionBlacklistSet.add(key))
    sk.forEach((key: string) => encryptionBlacklistSet.add(key))
  })

  return JSON.stringify(Array.from(encryptionBlacklistSet))
}
