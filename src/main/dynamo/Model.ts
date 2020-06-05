import { PartitionAndSortKey, PartitionKeyAndSortKeyPrefix } from "./keys"
import { Table } from "./Table"
import { TaggedModel } from "./types"
import { key } from "aws-sdk/clients/signer"

export class Model<
  T extends TaggedModel,
  U extends keyof T,
  V extends keyof T
  > {
  constructor(
    private table: Table,
    private partitionKeyPrefix: string,
    private partitionKeyField: U | U[],
    private sortKeyPrefix: string,
    private sortKeyField: V | V[],
    readonly modelTag: string
  ) { }

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
      this.buildKey(
        partitionKeyPrefix,
        this._buildPartitionKey(params, partitionKeyField)),

      this.table.sortKeyName,
      this.buildKey(
        sortKeyPrefix,
        this._buildSortKey(params, sortKeyField)),
      this.modelTag
    )
  }

  partitionKey(params: { [X in U]: string }): PartitionKeyAndSortKeyPrefix<T> {
    const { partitionKeyPrefix, partitionKeyField } = this
    return new PartitionKeyAndSortKeyPrefix(
      this.table.partitionKeyName,
      this.buildKey(
        partitionKeyPrefix,
        this._buildPartitionKey(params, partitionKeyField)),
      this.table.sortKeyName,
      this.sortKeyPrefix,
      this.modelTag
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
      this._buildPartitionKey(fieldsWithTag, partitionKeyField))
    const sk = this.buildKey(
      sortKeyPrefix,
      this._buildSortKey(fieldsWithTag, sortKeyField))

    return {
      ...fieldsWithTag,
      [this.table.partitionKeyName]: pk,
      [this.table.sortKeyName]: sk,
    }
  }

  /* TODO: Had issue mapping unioned fields of T & V */
  private _buildPartitionKey(model: { [X in U]: string }, fields: U | U[]): string | string[] {
    if (Array.isArray(fields)) {
      const pkey: string[] = [];
      for (const field of fields) {
        const value = model[field]
        if (value) {
          pkey.push(value)
        } else {
          break
        }
      };
      return pkey
    }
    return model[fields as U]
  }

  private _buildSortKey(model: { [Y in V]: string }, fields: V | V[]): string | string[] {
    if (Array.isArray(fields)) {
      const skey: string[] = [];
      for (const field of fields) {
        const value = model[field]
        if (value) {
          skey.push(value)
        } else {
          break
        }
      };
      return skey
    }
    return model[fields as V]
  }

  private buildKey(prefix: string, key: string | string[]): string {
    if (Array.isArray(key)) {
      return `${prefix}-${key.join('-')}`
    }
    return `${prefix}-${key}`
  }
}

export class PartitionKeyBuilder<T extends TaggedModel> {
  constructor(private table: Table, private modelTag: string) { }
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
    private partitionKeyField: U | U[],
    private modelTag: string
  ) { }

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
