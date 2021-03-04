import { UnprocessedKeyCollector } from "../../main/dynamo/UnprocessedKeyCollector"
import { MusicianModel, table } from "./models"

describe("UnprocessedKeyCollector", () => {
  it("should collect unprocessed keys", () => {
    // Pretend we batchGet these 3 keys
    const key1 = MusicianModel.key({ id: "1" })
    const key2 = MusicianModel.key({ id: "2" })
    const key3 = MusicianModel.key({ id: "3" })
    const unprocessedKeys = new UnprocessedKeyCollector(table, [key1, key2, key3])

    // And DynamoDB gives us back these "raw" unprocessed keys in the response
    unprocessedKeys.add({ pk: "musician-1", sk: "musician-1" })
    unprocessedKeys.add({ pk: "musician-2", sk: "musician-2" })

    // So we should map those back to our original Beyonce input keys
    expect(unprocessedKeys.getUnprocessedKeys()).toEqual([key1, key2])
  })
})
