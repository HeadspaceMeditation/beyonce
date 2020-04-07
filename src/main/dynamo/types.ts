import { Model } from "./Model"

export type ExtractFields<T> = T extends Model<infer U, any, any> ? U : never
export type ModelType = Record<string, any> & { model: string }
