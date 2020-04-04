import { Model } from "./types"

export function generateTaggedUnion(models: Model[]): string {
  const union = models.map((_) => _.name).join(" | ")
  return `export type Model = ${union}`
}
