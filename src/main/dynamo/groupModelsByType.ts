import { GroupedModels, TaggedModel } from "./types"

export function groupModelsByType<T extends TaggedModel>(
  models: T[]
): GroupedModels<T> {
  const groups = {} as GroupedModels<T>

  models.forEach((m) => {
    const modelType = m.model as T["model"]
    groups[modelType] = groups[modelType] || []
    groups[modelType].push(m)
  })

  return groups
}
