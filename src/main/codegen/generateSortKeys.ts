import { ModelSet } from "./types"

export function generateSortKeys(models: ModelSet) {
  const sks = models.map(({ name, sk }) => codeGenKeyGetter(name, sk))
  return `
      export const SK = {
        ${sks.join(",\n")}
      }
    `
}

function codeGenKeyGetter(modelName: string, keyParts: string[]): string {
  const inputFields: string[] = []
  const parts: string[] = []

  keyParts.forEach(part => {
    if (part.startsWith("_.")) {
      inputFields.push(part.replace("_.", ""))
      parts.push(part)
    } else {
      parts.push(`"${part}"`)
    }
  })

  const inputType = inputFields.map(_ => `${_}: string`).join(",")
  return `[ModelType.${modelName}]: new Key<${modelName}, {${inputType}}>(_ => [${parts.join(
    ", "
  )}])`
}
