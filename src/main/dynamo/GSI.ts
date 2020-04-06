import { PartitionKey } from "./keys"
import { Model } from "./Model"
import { Table } from "./Table"
import { ExtractFields } from "./types"

export class GSI<T extends Model<any, any, any>> {
  constructor(
    private table: Table,
    readonly name: string,
    private models: T[],
    private partitionKeyName: keyof ExtractFields<T>
  ) {
    this.table.addToEncryptionBlacklist(partitionKeyName)
  }

  key(partitionKey: string): PartitionKey<ExtractFields<T>> {
    return new PartitionKey(this.partitionKeyName, partitionKey)
  }
}

export class GSIBuilder {
  constructor(private table: Table, private name: string) {}

  models<T extends Model<any, any, any>>(models: T[]) {
    return new GSIPartitionKeyBuilder(this.table, this.name, models)
  }
}

export class GSIPartitionKeyBuilder<T extends Model<any, any, any>> {
  constructor(
    private table: Table,
    private name: string,
    private models: T[]
  ) {}

  partitionKey(partitionKeyName: keyof ExtractFields<T>) {
    return new GSI(this.table, this.name, this.models, partitionKeyName)
  }
}
