import { Model } from "./types"
import { formatKeyComponent } from "./util"

export function generateModels(models: Model[]) {
  return models.map(generateModel)
}

function generateModel(model: Model): string {
  const [pkPrefix, ...pkComponents] = model.keys.partitionKey.map(
    formatKeyComponent
  )

  const [skPrefix, ...skComponents] = model.keys.sortKey.map(formatKeyComponent)

  return `export const ${model.name}Model = ${model.tableName}Table
    .model<${model.name}>(ModelType.${model.name})
    .partitionKey(${pkPrefix}, ${pkComponents.join(", ")})
    .sortKey(${skPrefix}, ${skComponents.join(", ")})
  `
}
