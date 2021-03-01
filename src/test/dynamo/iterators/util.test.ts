import { ready } from "libsodium-wrappers"
import { maybeDeserializeCursor, maybeSerializeCursor } from "../../../main/dynamo/iterators/util"

describe("iterator utils", () => {
  beforeAll(async () => await ready)

  it("should serialize a lastEvaluatedKey to a cursor", () => {
    const cursor = maybeSerializeCursor({ pk: "Bob", sk: "Marley" })
    expect(cursor).toEqual("eyJwayI6IkJvYiIsInNrIjoiTWFybGV5In0")
  })

  it("should not serialize an undefined lastEvaluatedKey", () => {
    expect(maybeSerializeCursor()).toEqual(undefined)
  })

  it("should deserialize a cursor into a lastEvaluatedKey", () => {
    const lastEvaluatedKey = maybeDeserializeCursor("eyJwayI6IkJvYiIsInNrIjoiTWFybGV5In0")
    expect(lastEvaluatedKey).toEqual({ pk: "Bob", sk: "Marley" })
  })

  it("shoud not deserialize an undefined cursor", () => {
    expect(maybeDeserializeCursor()).toEqual(undefined)
  })
})
