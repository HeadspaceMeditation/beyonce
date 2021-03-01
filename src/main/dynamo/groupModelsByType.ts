import { GroupedModels, TaggedModel } from "./types"

export function groupModelsByType<T extends TaggedModel>(models: T[], modelTags: T["model"][]): GroupedModels<T> {
  const groups = {} as GroupedModels<T>

  modelTags.forEach((tag) => {
    groups[tag] = [] as any
  })

  models.forEach((m) => {
    const modelType = m.model as T["model"]
    groups[modelType].push(m)
  })

  return groups
}
