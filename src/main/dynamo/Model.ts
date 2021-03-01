import { PartitionAndSortKey, PartitionKeyAndSortKeyPrefix } from "./keys"
import { Table } from "./Table"
import { TaggedModel } from "./types"

export class Model<T extends TaggedModel, U extends keyof T, V extends keyof T> {
  constructor(
    private table: Table,
    private partitionKeyPrefix: string,
    private partitionKeyFields: U[],
    private sortKeyPrefix: string,
    private sortKeyFields: V[],
    readonly modelTag: string
  ) {}

  key(params: { [X in U]: string } & { [Y in V]: string }): PartitionAndSortKey<T> {
    const { partitionKeyPrefix, sortKeyPrefix, partitionKeyFields, sortKeyFields } = this
    const pkComponents = partitionKeyFields.map((_) => params[_])
    const skComponents = sortKeyFields.map((_) => params[_])
    return new PartitionAndSortKey(
      this.table.partitionKeyName,
      this.buildKey(partitionKeyPrefix, ...pkComponents),

      this.table.sortKeyName,
      this.buildKey(sortKeyPrefix, ...skComponents),
      this.modelTag
    )
  }

  partitionKey(params: { [X in U]: string }): PartitionKeyAndSortKeyPrefix<T> {
    const { partitionKeyPrefix, partitionKeyFields } = this
    const pkComponents = partitionKeyFields.map((_) => params[_])
    return new PartitionKeyAndSortKeyPrefix(
      this.table.partitionKeyName,
      this.buildKey(partitionKeyPrefix, ...pkComponents),
      this.table.sortKeyName,
      this.sortKeyPrefix,
      this.modelTag
    )
  }

  create(fields: Omit<T, "model">) {
    const { partitionKeyPrefix, sortKeyPrefix, partitionKeyFields, sortKeyFields, modelTag } = this

    const fieldsWithTag = { ...fields, model: modelTag } as T

    const pkComponents = partitionKeyFields.map((_) => fieldsWithTag[_])
    const skComponents = sortKeyFields.map((_) => fieldsWithTag[_])

    const pk = this.buildKey(partitionKeyPrefix, ...pkComponents)
    const sk = this.buildKey(sortKeyPrefix, ...skComponents)

    return {
      ...fieldsWithTag,
      [this.table.partitionKeyName]: pk,
      [this.table.sortKeyName]: sk
    }
  }

  private buildKey(...components: string[]): string {
    return components.join("-")
  }
}

export class PartitionKeyBuilder<T extends TaggedModel> {
  constructor(private table: Table, private modelTag: string) {}
  partitionKey<U extends keyof T>(prefix: string, ...partitionKeyFields: U[]): SortKeyBuilder<T, U> {
    return new SortKeyBuilder(this.table, prefix, partitionKeyFields, this.modelTag)
  }
}

export class SortKeyBuilder<T extends TaggedModel, U extends keyof T> {
  constructor(
    private table: Table,
    private partitionKeyPrefix: string,
    private partitionKeyFields: U[],
    private modelTag: string
  ) {}

  sortKey<V extends keyof T>(prefix: string, ...sortKeyFields: V[]): Model<T, U, V> {
    return new Model(this.table, this.partitionKeyPrefix, this.partitionKeyFields, prefix, sortKeyFields, this.modelTag)
  }
}
