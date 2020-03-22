import { Table } from "./types"
import { intersection } from "./util"

export function generateGSIs(table: Table): string {
  const fieldToType: { [fieldName: string]: string } = {
    model: "string"
  }

  const fieldToModels: { [fieldName: string]: string[] } = {
    model: []
  }

  table.models.forEach(model => {
    fieldToModels["model"].push(model.name)

    for (const name in model.fields) {
      fieldToType[name] = model.fields[name]
      fieldToModels[name] = fieldToModels[name] || []
      fieldToModels[name].push(model.name)
    }
  })

  const gsis = table.gsis.map(({ name, partition, sort }) => {
    const partitionKeyType = fieldToType[partition]
    const partitionModelsType = fieldToModels[partition].join(" | ")

    const sortKeyType = fieldToType[sort]
    const sortModelType = intersection(
      fieldToModels[partition],
      fieldToModels[sort]
    ).join(" | ")

    return `
        ${name}: {
            name: "${name}",
            pk: key<{${partition}:${partitionKeyType}}, ${partitionModelsType}>("${partition}", _ => [_.${partition}]),
            sk: key<{${sort}:${sortKeyType}}, ${sortModelType}>("${sort}", _ => [_.${sort}])
        }
    `
  })

  if (gsis.length > 0) {
    return `gsis: {
    ${gsis.join(",\n")}
    }`
  } else {
    return ""
  }
}
