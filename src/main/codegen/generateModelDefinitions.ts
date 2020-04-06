import { Model } from "./types"

export function generateModelDefinitions(models: Model[]) {
  return models.map(generateModelDefinition)
}

function generateModelDefinition(model: Model): string {
  return `export const ${model.name}Model = ${model.tableName}
    .model<${model.name}>()
    .partitionKey(${model.partition})
    .sortKey(${model.sort})
  `
}
