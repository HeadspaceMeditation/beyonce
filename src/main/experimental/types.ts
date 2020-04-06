import { Model } from "./Model"
export type ExtractFields<T> = T extends Model<infer U, any, any> ? U : never
