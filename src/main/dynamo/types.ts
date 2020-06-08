import { Model } from "./Model"
import { PartitionAndSortKey } from "./keys"

export type ExtractFields<T> = T extends Model<infer U, any, any> ? U : never
export type TaggedModel = Record<string, any> & { model: string }

export type ExtractKeyType<T> = T extends PartitionAndSortKey<infer U>
  ? U
  : never

export type GroupedModels<T extends TaggedModel> = {
  [K in T["model"]]: T extends { model: K } ? T[] : never
}

export type AtLeastOne<T, U = { [K in keyof T]: Pick<T, K> }> = Partial<T> & U[keyof U]
