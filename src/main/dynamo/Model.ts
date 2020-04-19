import {
  PartitionAndSortKey,
  PartitionKey,
  PartitionKeyAndSortKeyPrefix,
} from "./keys"
import { Table } from "./Table"
import { TaggedModel } from "./types"

export class Model<
  T extends TaggedModel,
  U extends keyof T,
  V extends keyof T
> {
  constructor(
    private table: Table,
    private partitionKeyPrefix: string,
    private partitionKeyField: U,
    private sortKeyPrefix: string,
    private sortKeyField: V,
    private modelTag: string
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

  partitionKey(params: { [X in U]: string }): PartitionKeyAndSortKeyPrefix<T> {
    const { partitionKeyPrefix, partitionKeyField } = this
    return new PartitionKeyAndSortKeyPrefix(
      this.table.partitionKeyName,
      this.buildKey(partitionKeyPrefix, params[partitionKeyField]),
      this.table.sortKeyName,
      this.sortKeyPrefix
    )
  }

  create(fields: Omit<T, "model">) {
    const {
      partitionKeyPrefix,
      sortKeyPrefix,
      partitionKeyField,
      sortKeyField,
      modelTag,
    } = this

    const fieldsWithTag = { ...fields, model: modelTag } as T

    const pk = this.buildKey(
      partitionKeyPrefix,
      fieldsWithTag[partitionKeyField]
    )
    const sk = this.buildKey(sortKeyPrefix, fieldsWithTag[sortKeyField])

    return {
      ...fieldsWithTag,
      [this.table.partitionKeyName]: pk,
      [this.table.sortKeyName]: sk,
    }
  }

  private buildKey(prefix: string, key: string): string {
    return `${prefix}-${key}`
  }
}

export class PartitionKeyBuilder<T extends TaggedModel> {
  constructor(private table: Table, private modelTag: string) {}
  partitionKey<U extends keyof T>(
    prefix: string,
    partitionKeyField: U
  ): SortKeyBuilder<T, U> {
    return new SortKeyBuilder(
      this.table,
      prefix,
      partitionKeyField,
      this.modelTag
    )
  }
}

export class SortKeyBuilder<T extends TaggedModel, U extends keyof T> {
  constructor(
    private table: Table,
    private partitionKeyPrefix: string,
    private partitionKeyField: U,
    private modelTag: string
  ) {}

  sortKey<V extends keyof T>(prefix: string, sortKeyField: V): Model<T, U, V> {
    return new Model(
      this.table,
      this.partitionKeyPrefix,
      this.partitionKeyField,
      prefix,
      sortKeyField,
      this.modelTag
    )
  }
}
