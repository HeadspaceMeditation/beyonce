import { Model } from "./Model"

/** A DynamoDB partition or sort key. T is the type of model that lives under this key in Dynamo
 *  (it might be a union type or a single type). And we use a class here to "hold onto" that type
 */
export class Key<T extends Model> {
  constructor(public readonly value: string) {}
}

export function key<T, U extends Model>(
  createKey: (input: T) => string[]
): (input: T) => Key<U> {
  return (input: T) => new Key<U>(createKey(input).join("|"))
}
