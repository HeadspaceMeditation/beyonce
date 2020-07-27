import { GSIBuilder } from "./GSI"
import { Model, PartitionKeyBuilder } from "./Model"
import { Partition } from "./Partition"
import { TaggedModel } from "./types"

export class Table<PK extends string = string, SK extends string = string> {
  readonly tableName: string
  readonly partitionKeyName: PK
  readonly sortKeyName: SK
  private encryptionBlacklist: Set<string>

  constructor(config: {
    name: string
    partitionKeyName: PK
    sortKeyName: SK
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
      ...(config.encryptionBlacklist ?? []),
    ])
  }

  model<T extends TaggedModel>(modelType: T["model"]): PartitionKeyBuilder<T> {
    return new PartitionKeyBuilder(this, modelType)
  }

  partition<T extends Model<any, any, any>, U extends Model<any, any, any>>(
    models: [T, ...U[]]
  ): Partition<T, U> {
    return new Partition(models)
  }

  gsi(name: string): GSIBuilder<PK, SK> {
    return new GSIBuilder(this, name)
  }

  addToEncryptionBlacklist(field: string) {
    this.encryptionBlacklist.add(field)
  }

  getEncryptionBlacklist(): Set<string> {
    return this.encryptionBlacklist
  }
}
