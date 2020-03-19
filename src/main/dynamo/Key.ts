import { Model } from "./Model"

export class Key<T extends Model, U> {
  constructor(private createKey: (input: U) => string[]) {}
  key(input: U): string {
    return this.createKey(input).join("|")
  }
}
