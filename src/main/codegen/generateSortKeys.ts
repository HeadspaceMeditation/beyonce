import { Table } from "./types"

export function generateSortKeys(table: Table) {
  const sks = table.models.map(({ name, sort }) => codeGenKeyGetter(name, sort))
  return `
      sk: {
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
  return `[ModelType.${modelName}]: key<{${inputType}}, ${modelName}>("sk", _ => [${parts.join(
    ", "
  )}])`
}
