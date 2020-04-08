import { PartitionKey } from "./keys"
import { Model } from "./Model"
import { Table } from "./Table"
import { ExtractFields } from "./types"

export class GSI<T extends Model<any, any, any>> {
  constructor(
    private table: Table,
    readonly name: string,
    private models: T[],
    private partitionKeyName: keyof ExtractFields<T>,
    private sortKeyName: keyof ExtractFields<T>
  ) {
    this.table.addToEncryptionBlacklist(this.partitionKeyName)
    this.table.addToEncryptionBlacklist(this.sortKeyName)
  }

  key(partitionKey: string): PartitionKey<ExtractFields<T>> {
    return new PartitionKey(this.partitionKeyName, partitionKey)
  }
}

export class GSIBuilder {
  constructor(private table: Table, private name: string) {}

  models<T extends Model<any, any, any>>(models: T[]) {
    return new GSIKeyBuilder(this.table, this.name, models)
  }
}

class GSIKeyBuilder<T extends Model<any, any, any>> {
  private partitionKeyName?: keyof ExtractFields<T>

  constructor(
    private table: Table,
    private name: string,
    private models: T[]
  ) {}

  partitionKey(partitionKeyName: keyof ExtractFields<T>): this {
    this.partitionKeyName = partitionKeyName
    return this
  }

  sortKey(sortKeyName: keyof ExtractFields<T>): GSI<T> {
    return new GSI(
      this.table,
      this.name,
      this.models,
      this.partitionKeyName!,
      sortKeyName
    )
  }
}
