import { GSIBuilder } from "./GSI"
import { Model, PartitionKeyBuilder } from "./Model"
import { Partition } from "./Partition"
import { ModelType } from "./types"

export class Table {
  readonly tableName: string
  readonly partitionKeyName: string
  readonly sortKeyName: string
  private encryptionBlacklist: Set<string>

  constructor(config: {
    name: string
    partitionKeyName: string
    sortKeyName: string,
    encryptionBlacklist?: string[]
  }) {
    this.tableName = config.name
    this.partitionKeyName = config.partitionKeyName
    this.sortKeyName = config.sortKeyName

    this.encryptionBlacklist = new Set([
      "model",
      "__jayz__metadata",
      this.partitionKeyName,
      this.sortKeyName,
      ...config.encryptionBlacklist ?? []])
  }

  model<T extends ModelType>(modelType: T["model"]): PartitionKeyBuilder<T> {
    return new PartitionKeyBuilder(this, modelType)
  }

  partition<T extends Model<any, any, any>, U extends Model<any, any, any>>(
    models: [T, ...U[]]
  ): Partition<T, U> {
    return new Partition(models)
  }

  gsi(name: string): GSIBuilder {
    return new GSIBuilder(this, name)
  }

  addToEncryptionBlacklist(field: string) {
    this.encryptionBlacklist.add(field)
  }

  getEncryptionBlacklist(): Set<string> {
    return this.encryptionBlacklist
  }
}
