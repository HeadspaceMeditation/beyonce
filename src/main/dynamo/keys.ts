export class PartitionKey<T> {
  constructor(
    readonly partitionKeyName: string,
    readonly partitionKey: string
  ) {}
}

export class PartitionAndSortKey<T> {
  constructor(
    readonly partitionKeyName: string,
    readonly partitionKey: string,
    readonly sortKeyName: string,
    readonly sortKey: string
  ) {}

  // Required to avoid TypeScript's structural typing from collapsing
  // PartitionAndSortKey<T> and PartitionAndSortKey<U> into the same object.
  private dummy(item: T) {}
}
