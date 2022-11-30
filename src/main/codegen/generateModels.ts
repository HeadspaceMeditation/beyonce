import { Model } from "./types"
import { formatKeyComponent } from "./util"

// Dynamo also supports keys of type 'Binary' but we don't use those anywhere
export const AllowedKeyTypes: string[] = ["string", "number"];

export function generateModels(models: Model[]) {
  return models.map(generateModel)
}

const validateKeyStructure = (
    model: Model,
    keyComponents: string[]
) => {
  let invalidKeyType: string | null = null;
  Object.entries(model.fields).forEach((entry) => {
    if (!AllowedKeyTypes.includes(entry[1]) && keyComponents.includes(formatKeyComponent(entry[0]))) {
      invalidKeyType = entry[1];
    }
  });

  if (invalidKeyType !== null) {
    throw new Error(`A key with type ${invalidKeyType} is not allowed. DynamoDB keys must be of type 'string' or 'number'`);
  }
}

function generateModel(model: Model): string {
  const [pkPrefix, ...pkComponents] = model.keys.partitionKey.map(formatKeyComponent)

  const [skPrefix, ...skComponents] = model.keys.sortKey.map(formatKeyComponent)

  validateKeyStructure(model, pkComponents);
  validateKeyStructure(model, skComponents);

  return `export const ${model.name}Model = ${model.tableName}Table
    .model<${model.name}>(ModelType.${model.name})
    .partitionKey(${pkPrefix}, ${pkComponents.join(", ")})
    .sortKey(${skPrefix}, ${skComponents.join(", ")})
  `
}
