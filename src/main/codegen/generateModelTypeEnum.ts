import { Model } from "./types"

export function generateModelTypeEnum(models: Model[]): string {
  const entries = models.map(({ name }) => `${name} = "${name}"`)
  return `
      export enum ModelType {
        ${entries.join(",\n")}
      }
    `
}
