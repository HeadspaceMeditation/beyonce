import { PartitionKey } from "./keys"
import { Model } from "./Model"
import { Table } from "./Table"
import { ExtractFields } from "./types"

type StringKey<T> = keyof ExtractFields<T> & string

export class GSI<T extends Model<any, any, any>> {
  private modelTags: string[]

  constructor(
    private table: Table,
    readonly name: string,
    private models: T[],
    private partitionKeyName: StringKey<T>,
    private sortKeyName: StringKey<T>
  ) {
    this.table.addToEncryptionBlacklist(this.partitionKeyName)
    this.table.addToEncryptionBlacklist(this.sortKeyName)
    this.modelTags = models.map((_) => _.modelTag)
  }

  key(partitionKey: string): PartitionKey<ExtractFields<T>> {
    return new PartitionKey(this.partitionKeyName, partitionKey, this.modelTags)
  }
}

export class GSIBuilder {
  constructor(private table: Table, private name: string) {}

  models<T extends Model<any, any, any>>(models: T[]) {
    return new GSIKeyBuilder(this.table, this.name, models)
  }
}

class GSIKeyBuilder<T extends Model<any, any, any>> {
  private partitionKeyName?: StringKey<T>

  constructor(
    private table: Table,
    private name: string,
    private models: T[]
  ) {}

  partitionKey(partitionKeyName: StringKey<T>): this {
    this.partitionKeyName = partitionKeyName
    return this
  }

  sortKey(sortKeyName: StringKey<T>): GSI<T> {
    return new GSI(
      this.table,
      this.name,
      this.models,
      this.partitionKeyName!,
      sortKeyName
    )
  }
}
