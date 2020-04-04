/** A DynamoDB partition or sort key. T is the type of model that lives under this key in Dynamo
 *  (it might be a union type or a single type). And we use a class here to "hold onto" that type
 */
export class Key<T> {
  constructor(public readonly name: string, public readonly value: string) {}
}

export function key<T, U>(
  name: string,
  createKey: (input: T) => string[]
): (input: T) => Key<U> {
  return (input: T) => new Key<U>(name, createKey(input).join("|"))
}
