import { PartitionAndSortKey, PartitionKey } from "./keys"
import { Table } from "./Table"

export class Model<
  T extends Record<string, any>,
  U extends keyof T,
  V extends keyof T
> {
  constructor(
    private table: Table,
    private partitionKeyPrefix: string,
    private partitionKeyField: U,
    private sortKeyPrefix: string,
    private sortKeyField: V
  ) {}

  key(
    params: { [X in U]: string } & { [Y in V]: string }
  ): PartitionAndSortKey<T> {
    const {
      partitionKeyPrefix,
      sortKeyPrefix,
      partitionKeyField,
      sortKeyField,
    } = this
    return new PartitionAndSortKey(
      this.table.partitionKeyName,
      this.buildKey(partitionKeyPrefix, params[partitionKeyField]),

      this.table.sortKeyName,
      this.buildKey(sortKeyPrefix, params[sortKeyField])
    )
  }

  partitionKey(params: { [X in U]: string }): PartitionKey<T> {
    const { partitionKeyPrefix, partitionKeyField } = this
    return new PartitionKey(
      this.table.partitionKeyName,
      this.buildKey(partitionKeyPrefix, params[partitionKeyField])
    )
  }

  create(fields: T) {
    const {
      partitionKeyPrefix,
      sortKeyPrefix,
      partitionKeyField,
      sortKeyField,
    } = this

    const pk = this.buildKey(partitionKeyPrefix, fields[partitionKeyField])
    const sk = this.buildKey(sortKeyPrefix, fields[sortKeyField])

    return {
      [this.table.partitionKeyName]: pk,
      [this.table.sortKeyName]: sk,
      ...fields,
    }
  }

  private buildKey(prefix: string, key: string): string {
    return `${prefix}-${key}`
  }
}

export class PartitionKeyBuilder<T> {
  constructor(private table: Table) {}
  partitionKey<U extends keyof T>(
    prefix: string,
    partitionKeyField: U
  ): SortKeyBuilder<T, U> {
    return new SortKeyBuilder(this.table, prefix, partitionKeyField)
  }
}

export class SortKeyBuilder<T, U extends keyof T> {
  constructor(
    private table: Table,
    private partitionKeyPrefix: string,
    private partitionKeyField: U
  ) {}

  sortKey<V extends keyof T>(prefix: string, sortKeyField: V): Model<T, U, V> {
    return new Model(
      this.table,
      this.partitionKeyPrefix,
      this.partitionKeyField,
      prefix,
      sortKeyField
    )
  }
}
