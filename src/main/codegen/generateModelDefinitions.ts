import { Model } from "./types"

export function generateModelDefinitions(models: Model[]) {
  return models.map(generateModelDefinition)
}

function generateModelDefinition(model: Model): string {
  const [pkPrefix, pk] = model.keys.partitionKey
  const [skPrefix, sk] = model.keys.sortKey

  return `export const ${model.name}Model = ${model.tableName}Table
    .model<${model.name}>()
    .partitionKey(ModelType.${pkPrefix}, "${pk.replace("$", "")}")
    .sortKey(ModelType.${skPrefix}, "${sk.replace("$", "")}")
  `
}
