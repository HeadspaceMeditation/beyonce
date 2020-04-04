import { Model } from "./types"

export function generateModelHelpers(models: Model[]): string {
  const helpers = models.map((m) => {
    const modelHelperName = m.name.replace(/^\w/, (_) => _.toLowerCase())

    return `export function ${modelHelperName}(fields: Omit<${m.name}, "model">): ${m.name} {
        return {
            ...fields,
            model: ModelType.${m.name}
        }
    }`
  })

  return helpers.join("\n\n")
}
