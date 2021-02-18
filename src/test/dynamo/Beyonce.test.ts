import { JayZ } from "@ginger.io/jay-z"
import { DynamoDB } from "aws-sdk"
import { Beyonce } from "../../main/dynamo/Beyonce"
import {
  aMusicianWithTwoSongs,
  byModelAndIdGSI,
  invertedIndexGSI,
  ModelType,
  MusicianModel,
  MusicianPartition,
  SongModel,
  table
} from "./models"
import { createJayZ, setup } from "./util"

describe("Beyonce", () => {
  // Without encryption
  it("should put and retrieve an item using pk + sk", async () => {
    await testPutAndRetrieveItem()
  })

  it("should put and retrieve an item with an undefined field", async () => {
    await testPutAndRetrieveItemWithUndefinedField()
  })

  it("should put and retrieve a model with a compound partition key", async () => {
    await testPutAndRetrieveCompoundPartitionKey()
  })

  it("should put and retrieve a model with a compound sort key", async () => {
    await testPutAndRetrieveCompoundSortKey()
  })

  it("should update a top-level item attribute", async () => {
    const db = await setup()
    const [musician, _, __] = aMusicianWithTwoSongs()
    await db.put(musician)

    const updated = await db.update(
      MusicianModel.key({ id: musician.id }),
      (musician) => {
        musician.name = "Gary Moore"
      }
    )

    expect(updated).toEqual({ ...musician, name: "Gary Moore" })

    const reRead = await db.get(MusicianModel.key({ id: musician.id }))
    expect(reRead).toEqual({ ...musician, name: "Gary Moore" })
  })

  it("should update a nested item attribute", async () => {
    const db = await setup()
    const [musician, _, __] = aMusicianWithTwoSongs()
    await db.put(musician)

    const updated = await db.update(
      MusicianModel.key({ id: musician.id }),
      (musician) => {
        musician.details.description = "scottish blues dude"
      }
    )

    expect(updated).toEqual({
      ...musician,
      details: { description: "scottish blues dude" }
    })
  })

  it("should remove an item attribute", async () => {
    const db = await setup()
    const [m, _, __] = aMusicianWithTwoSongs()
    const musician = { ...m, details: { description: "rasta man" } }
    await db.put(musician)

    const updated = await db.update(
      MusicianModel.key({ id: musician.id }),
      (musician) => {
        delete musician.details.description
      }
    )

    expect(updated).toEqual({
      ...musician,
      details: {}
    })
  })

  it("should support a consistentRead option on get", async () => {
    await setup()
    const [musician, _, __] = aMusicianWithTwoSongs()

    const mockGet = jest.fn(() => ({
      promise: () =>
        Promise.resolve({
          Item: musician
        })
    }))

    const db = new Beyonce(table, new DynamoDB({ region: "us-west-2" }))
    ;(db as any).client.get = mockGet

    await db.get(MusicianModel.key({ id: musician.id }), {
      consistentRead: true
    })
    expect(mockGet).toHaveBeenCalledWith({
      TableName: table.tableName,
      Key: {
        pk: "musician-1",
        sk: "musician-1"
      },
      ConsistentRead: true
    })
  })

  it("should put and delete an item using pk + sk", async () => {
    await testPutAndDeleteItem()
  })

  it("should put and delete in the same transaction", async () => {
    await testPutAndDeleteItemInTransaction()
  })

  it("should set consistent read on queries", async () => {
    const db = await setup()
    const query = await (db as any)
      .query(MusicianModel.partitionKey({ id: "musician-1" }), {
        consistentRead: true
      })
      .createQueryInput({})

    expect(query).toMatchObject({
      ConsistentRead: true
    })
  })

  it("should batchGet items", async () => {
    await testBatchGet()
  })

  it("should support a consistentRead option on batchGet", async () => {
    await setup()
    const [musician, _, __] = aMusicianWithTwoSongs()

    const mockGet = jest.fn(() => ({
      promise: () =>
        Promise.resolve({
          Item: musician
        })
    }))

    const db = new Beyonce(table, new DynamoDB({ region: "us-west-2" }))
    ;(db as any).client.batchGet = mockGet

    await db.batchGet({
      keys: [MusicianModel.key({ id: musician.id })],
      consistentRead: true
    })

    expect(mockGet).toHaveBeenCalledWith({
      RequestItems: {
        [table.tableName]: {
          ConsistentRead: true,
          Keys: [
            {
              pk: "musician-1",
              sk: "musician-1"
            }
          ]
        }
      }
    })
  })

  it("should return empty arrays when no items found during batchGet", async () => {
    await testEmptyBatchGet()
  })

  // GSIs
  it("should query GSI by model", async () => {
    await testGSIByModel()
  })

  it("should query inverted index GSI", async () => {
    await testInvertedIndexGSI()
  })

  it("should write multiple items at once using transaction", async () => {
    await testBatchWriteWithTransaction()
  })

  it("should write multiple items at once ", async () => {
    await testBatchWrite()
  })

  // With JayZ encryption
  it("should put and retrieve an item using pk + sk with jayZ", async () => {
    const jayZ = await createJayZ()
    await testPutAndRetrieveItem(jayZ)
  })

  it("should put and retrieve an item with an undefined field with jayZ", async () => {
    const jayZ = await createJayZ()
    await testPutAndRetrieveItemWithUndefinedField(jayZ)
  })

  it("should put and retrieve a model with a compound partition key with jayZ", async () => {
    const jayZ = await createJayZ()
    await testPutAndRetrieveCompoundPartitionKey(jayZ)
  })

  it("should put and retrieve a model with a compound sort key", async () => {
    const jayZ = await createJayZ()
    await testPutAndRetrieveCompoundSortKey(jayZ)
  })

  it("should put and delete an item using pk + sk with jayZ", async () => {
    const jayZ = await createJayZ()
    await testPutAndDeleteItem(jayZ)
  })

  it("should put and delete in the same transaction with jayZ", async () => {
    const jayZ = await createJayZ()
    await testPutAndDeleteItemInTransaction(jayZ)
  })

  it("should batchGet items with jayZ", async () => {
    const jayZ = await createJayZ()
    await testBatchGet(jayZ)
  })

  it("should return empty arrays when no items found during batchGet with jayZ", async () => {
    const jayZ = await createJayZ()
    await testEmptyBatchGet(jayZ)
  })

  it("should query GSI by model with jayZ", async () => {
    const jayZ = await createJayZ()
    await testGSIByModel(jayZ)
  })

  it("should query inverted index GSI by name with jayZ", async () => {
    const jayZ = await createJayZ()
    await testInvertedIndexGSI(jayZ)
  })

  it("should write multiple items at once in a transact with jayZ", async () => {
    const jayZ = await createJayZ()
    await testBatchWriteWithTransaction(jayZ)
  })

  it("should write multiple items at once with jayZ", async () => {
    const jayZ = await createJayZ()
    await testBatchWrite(jayZ)
  })
})

async function testPutAndRetrieveItem(jayZ?: JayZ) {
  const db = await setup(jayZ)
  const [musician, _, __] = aMusicianWithTwoSongs()
  await db.put(musician)

  const result = await db.get(MusicianModel.key({ id: musician.id }))
  expect(result).toEqual(musician)
}

async function testPutAndRetrieveItemWithUndefinedField(jayZ?: JayZ) {
  const db = await setup(jayZ)
  const musician = MusicianModel.create({
    id: "1",
    name: "Bob Marley",
    divaRating: undefined,
    details: {
      description: "rasta man"
    }
  })
  await db.put(musician)

  const result = await db.get(MusicianModel.key({ id: musician.id }))
  expect(result).toEqual(musician)
}

async function testPutAndDeleteItem(jayZ?: JayZ) {
  const db = await setup(jayZ)
  const [musician, _, __] = aMusicianWithTwoSongs()
  await db.put(musician)

  const key = MusicianModel.key({ id: musician.id })

  expect(await db.get(key)).toEqual(musician)
  await db.delete(key)
  expect(await db.get(key)).toEqual(undefined)
}

async function testPutAndDeleteItemInTransaction(jayZ?: JayZ) {
  const db = await setup(jayZ)
  const [musician, song1, song2] = aMusicianWithTwoSongs()
  await db.executeTransaction({ putItems: [musician, song1] })

  await db.executeTransaction({
    putItems: [song2],
    deleteItems: [SongModel.key({ musicianId: song1.musicianId, id: song1.id })]
  })

  expect(
    await db.get(SongModel.key({ musicianId: song2.musicianId, id: song2.id }))
  ).toEqual(song2)

  expect(
    await db.get(SongModel.key({ musicianId: song1.musicianId, id: song1.id }))
  ).toEqual(undefined)
}

async function testPutAndRetrieveCompoundPartitionKey(jayZ?: JayZ) {
  interface Person {
    model: "person"
    first: string
    last: string
    sortKey: string
  }

  const PersonModel = table
    .model<Person>("person")
    .partitionKey("Person", "first", "last")
    .sortKey("Person", "sortKey")

  const db = await setup(jayZ)
  const model = PersonModel.create({
    first: "Bob",
    last: "Smith",
    sortKey: "sortKey-123"
  })
  await db.put(model)

  const result = await db.get(
    PersonModel.key({ first: "Bob", last: "Smith", sortKey: "sortKey-123" })
  )

  expect(result).toEqual(model)
}

async function testPutAndRetrieveCompoundSortKey(jayZ?: JayZ) {
  interface LineItem {
    model: "lineItem"
    orderId: string
    id: string
    timestamp: string
  }

  const LineItemModel = table
    .model<LineItem>("lineItem")
    .partitionKey("OrderId", "orderId")
    .sortKey("LineItem", "id", "timestamp")

  const db = await setup(jayZ)
  const model = LineItemModel.create({
    id: "l1",
    orderId: "o1",
    timestamp: "456"
  })
  await db.put(model)

  const result = await db.get(
    LineItemModel.key({ id: "l1", orderId: "o1", timestamp: "456" })
  )
  expect(result).toEqual(model)
}

async function testBatchGet(jayZ?: JayZ) {
  const db = await setup(jayZ)

  const [musician, song1, song2] = aMusicianWithTwoSongs()
  await Promise.all([db.put(musician), db.put(song1), db.put(song2)])

  const results = await db.batchGet({
    keys: [
      MusicianModel.key({ id: musician.id }),
      SongModel.key({ musicianId: musician.id, id: song1.id }),
      SongModel.key({ musicianId: musician.id, id: song2.id })
    ]
  })

  sortById(results.song)
  expect(results).toEqual({
    musician: [musician],
    song: [song1, song2]
  })
}

async function testEmptyBatchGet(jayZ?: JayZ) {
  const db = await setup(jayZ)
  const [musician, song1, song2] = aMusicianWithTwoSongs()
  const results = await db.batchGet({
    keys: [
      MusicianModel.key({ id: musician.id }),
      SongModel.key({ musicianId: musician.id, id: song1.id }),
      SongModel.key({ musicianId: musician.id, id: song2.id })
    ]
  })

  expect(results).toEqual({
    musician: [],
    song: []
  })
}

async function testGSIByModel(jayZ?: JayZ) {
  const db = await setup(jayZ)
  const [musician, song1, song2] = aMusicianWithTwoSongs()
  await Promise.all([db.put(musician), db.put(song1), db.put(song2)])

  const result = await db
    .queryGSI(byModelAndIdGSI.name, byModelAndIdGSI.key(ModelType.Song))
    .exec()

  expect(result).toEqual({ musician: [], song: [song1, song2] })
}

async function testInvertedIndexGSI(jayZ?: JayZ) {
  const db = await setup(jayZ)

  const santana = MusicianModel.create({
    id: "1",
    name: "Santana",
    divaRating: 10,
    details: {
      description: "famous guitarist"
    }
  })

  const slash = MusicianModel.create({
    id: "2",
    name: "Slash",
    divaRating: 25,
    details: {
      description: "another famous guitarist"
    }
  })

  const santanasSong = SongModel.create({
    musicianId: santana.id,
    id: "1",
    title: "A song where Slash and Santana play together",
    mp3: Buffer.from("fake-data", "utf8")
  })

  const slashesSong = SongModel.create({
    musicianId: slash.id,
    id: "1", // note the same id as above
    title: "A song where Slash and Santana play together",
    mp3: Buffer.from("fake-data", "utf8")
  })

  await db.executeTransaction({
    putItems: [santana, slash, santanasSong, slashesSong]
  })

  // Now when we query our inverted index, pk and sk are reversed,
  // so song id: 1 => [santanasSong, slashesSong]
  const { song: songs } = await db
    .queryGSI(
      invertedIndexGSI.name,
      invertedIndexGSI.key(`${ModelType.Song}-1`)
    )
    .exec()

  expect(songs).toEqual([santanasSong, slashesSong])
}

async function testBatchWriteWithTransaction(jayZ?: JayZ) {
  const db = await setup(jayZ)
  const [musician, song1, song2] = aMusicianWithTwoSongs()
  await db.executeTransaction({ putItems: [musician, song1, song2] })

  const results = await db
    .query(MusicianPartition.key({ id: musician.id }))
    .exec()

  sortById(results.song)
  expect(results).toEqual({
    musician: [musician],
    song: [song1, song2]
  })
}

async function testBatchWrite(jayZ?: JayZ) {
  const db = await setup(jayZ)
  const [musician, song1, song2] = aMusicianWithTwoSongs()
  await db.batchPut({
    items: [musician, song1, song2]
  })

  const results = await db
    .query(MusicianPartition.key({ id: musician.id }))
    .exec()

  sortById(results.song)
  expect(results).toEqual({
    musician: [musician],
    song: [song1, song2]
  })
}

function sortById<T extends { id: string }>(items: T[]): T[] {
  return items.sort((a, b) => {
    if (a.id === b.id) {
      return 0
    } else if (a.id > b.id) {
      return 1
    } else {
      return -1
    }
  })
}
