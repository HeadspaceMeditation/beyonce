import { ModelSet } from "./types"

export function generateModelTypeEnum(models: ModelSet): string {
  const entries = models.map(({ name }) => `${name} = "${name}"`)
  return `
      export enum ModelType {
        ${entries.join(",\n")}
      }
    `
}
