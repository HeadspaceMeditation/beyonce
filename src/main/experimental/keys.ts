export function partitionAndSortKey<T, U extends keyof T, V extends keyof T>(
  constructor: new (...args: any[]) => T,
  partitionKeyName: string,
  partitionKey: U,
  sortKeyName: string,
  sortKey: V
): (
  params: { [W in U]: string } & { [X in V]: string }
) => PartitionAndSortKey<T> {
  return (params) =>
    new PartitionAndSortKey(
      partitionKeyName,
      params[partitionKey],
      sortKeyName,
      params[sortKey]
    )
}

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
