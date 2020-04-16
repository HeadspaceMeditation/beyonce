import { A, O } from "ts-toolbelt"
type User = {
  id: number
}

const symbol = Symbol("")
type Type<A extends any, Id extends string> = A & { [K in typeof symbol]: Id }
type MyX = Type<{}, "x">

type works = O.Update<User, "id", A.x | null>
type doesNotWork = O.Update<User, "id", MyX | null>
