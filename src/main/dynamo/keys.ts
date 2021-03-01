import { TaggedModel } from "./types"

export class PartitionKey<T extends TaggedModel> {
  constructor(readonly partitionKeyName: string, readonly partitionKey: string, readonly modelTags: T["model"][]) {}
}

export class PartitionKeyAndSortKeyPrefix<T extends TaggedModel> {
  constructor(
    readonly partitionKeyName: string,
    readonly partitionKey: string,
    readonly sortKeyName: string,
    readonly sortKeyPrefix: string,
    readonly modelTag: T["model"]
  ) {}
}

export class PartitionAndSortKey<T extends TaggedModel> {
  constructor(
    readonly partitionKeyName: string,
    readonly partitionKey: string,
    readonly sortKeyName: string,
    readonly sortKey: string,
    readonly modelTag: T["model"]
  ) {}

  // Required to avoid TypeScript's structural typing from collapsing
  // PartitionAndSortKey<T> and PartitionAndSortKey<U> into the same object.
  private dummy(item: T) {}
}
