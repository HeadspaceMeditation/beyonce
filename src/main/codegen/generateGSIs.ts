import { Fields, Table } from "./types"
import {buildKey, replaceKeyDollar} from "./util"

export function generateGSIs(tables: Table[]): string {
  return tables.map(generateGSIsForTable).join("\n\n")
}

function generateGSIsForTable(table: Table): string {
  const fieldToModels: { [fieldName: string]: string[] } = {
    model: [],
  }

  const fieldsAllModelsHave: Fields = {
    [table.partitionKeyName]: "string",
    [table.sortKeyName]: "string",
    model: "string",
  }

  table.partitions.forEach((partition) => {
    partition.models.forEach((model) => {
      const fields = { ...fieldsAllModelsHave, ...model.fields }

      for (const name in fields) {
        fieldToModels[name] = fieldToModels[name] || []
        fieldToModels[name].push(model.name)
      }
    })
  })

  const gsis = table.gsis.map(({ name, partitionKey, sortKey }) => {
    const pk = partitionKey.replace("$", "")
    const sk = sortKey.replace("$", "")
    const models = fieldToModels[pk].map((_) => `${_}Model`).join(", ")

    return `const ${name}GSI = ${table.name}Table.gsi("${name}")
      .models([${models}])
      .partitionKey("${pk}")
      .sortKey("${sk}")
    `
  })

  if (gsis.length > 0) {
    return gsis.join("\n\n")
  } else {
    return ""
  }
}
