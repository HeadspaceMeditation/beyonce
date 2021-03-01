import { PartitionKey } from "./keys"
import { Model } from "./Model"
import { Table } from "./Table"
import { ExtractFields } from "./types"

type StringKey<T> = keyof ExtractFields<T> & string

export class GSI<PK extends string, SK extends string, T extends Model<any, any, any>> {
  private modelTags: string[]

  constructor(
    private table: Table<PK, SK>,
    readonly name: string,
    private models: T[],
    readonly partitionKeyName: StringKey<T>,
    readonly sortKeyName: StringKey<T>
  ) {
    this.table.registerGSI(this)
    this.modelTags = models.map((_) => _.modelTag)
  }

  key(partitionKey: string): PartitionKey<ExtractFields<T>> {
    return new PartitionKey(this.partitionKeyName, partitionKey, this.modelTags)
  }
}

export class GSIBuilder<PK extends string, SK extends string> {
  constructor(private table: Table<PK, SK>, private name: string) {}

  models<T extends Model<any, any, any>>(models: T[]): GSIKeyBuilder<PK, SK, T> {
    return new GSIKeyBuilder(this.table, this.name, models)
  }
}

class GSIKeyBuilder<PK extends string, SK extends string, T extends Model<any, any, any>> {
  private partitionKeyName?: StringKey<T>

  constructor(private table: Table<PK, SK>, private name: string, private models: T[]) {}

  partitionKey(partitionKeyName: PK | SK | StringKey<T>): this {
    this.partitionKeyName = partitionKeyName
    return this
  }

  sortKey(sortKeyName: PK | SK | StringKey<T>): GSI<PK, SK, T> {
    return new GSI(this.table, this.name, this.models, this.partitionKeyName!, sortKeyName)
  }
}
