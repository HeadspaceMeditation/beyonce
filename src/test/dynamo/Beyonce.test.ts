import { FixedDataKeyProvider, JayZ } from "@ginger.io/jay-z"
import { DynamoDB } from "aws-sdk"
import crypto from "crypto"
import { Beyonce } from "../../main/dynamo/Beyonce"
import {
  aMusicianWithTwoSongs,
  byModelAndIdGSI,
  invertedIndexGSI,
  ModelType,
  MusicianModel,
  MusicianPartition,
  Song,
  SongModel,
  table,
} from "./models"
import { setup } from "./util"

describe("Beyonce", () => {
  // Without encryption
  it("should put and retrieve an item using pk + sk", async () => {
    await testPutAndRetrieveItem()
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
      details: { description: "scottish blues dude" },
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
      details: {},
    })
  })

  it("should support a consistentRead option on get", async () => {
    await setup()
    const [musician, _, __] = aMusicianWithTwoSongs()

    const mockGet = jest.fn(() => ({
      promise: () =>
        Promise.resolve({
          Item: musician,
        }),
    }))

    const db = new Beyonce(table, new DynamoDB({ region: "us-west-2" }))
    ;(db as any).client.get = mockGet

    await db.get(MusicianModel.key({ id: musician.id }), {
      consistentRead: true,
    })
    expect(mockGet).toHaveBeenCalledWith({
      TableName: table.tableName,
      Key: {
        pk: "musician-1",
        sk: "musician-1",
      },
      ConsistentRead: true,
    })
  })

  it("should put and delete an item using pk + sk", async () => {
    await testPutAndDeleteItem()
  })

  it("should put and retrieve multiple items using just pk", async () => {
    await testPutAndRetrieveMultipleItems()
  })

  it("should return empty arrays when no models found when querying", async () => {
    await testEmptyQuery()
  })

  it("should set consistent read on queries", async () => {
    const db = await setup()
    const query = await (db as any)
      .query(MusicianModel.partitionKey({ id: "musician-1" }), {
        consistentRead: true,
      })
      .buildQuery({})

    expect(query).toMatchObject({
      ConsistentRead: true,
    })
  })

  it("should query for only single type of model", async () => {
    await testQueryForSingleTypeOfModel()
  })

  it("should filter items when querying", async () => {
    await testQueryWithFilter()
  })

  it("should paginate query results", async () => {
    await testQueryWithPaginatedResults()
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
          Item: musician,
        }),
    }))

    const db = new Beyonce(table, new DynamoDB({ region: "us-west-2" }))
    ;(db as any).client.batchGet = mockGet

    await db.batchGet({
      keys: [MusicianModel.key({ id: musician.id })],
      consistentRead: true,
    })

    expect(mockGet).toHaveBeenCalledWith({
      RequestItems: {
        [table.tableName]: {
          ConsistentRead: true,
          Keys: [
            {
              pk: "musician-1",
              sk: "musician-1",
            },
          ],
        },
      },
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

  it("should write multiple items at once", async () => {
    await testBatchWriteWithTransaction()
  })

  it("should query with multiple attribute filters", async () => {
    await testQueryWithCombinedAttributeFilters()
  })

  it("should set maxRecordsToProcess", async () => {
    await testQueryWithLimit()
  })

  it("should find the highest sort key", async () => {
    await testQueryWithReverseAndLimit()
  })

  // With JayZ encryption
  it("should put and retrieve an item using pk + sk with jayZ", async () => {
    const jayZ = await createJayZ()
    await testPutAndRetrieveItem(jayZ)
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
    await testPutAndDeleteItem()
  })

  it("should put and retrieve multiple items using just pk with jayZ", async () => {
    const jayZ = await createJayZ()
    await testPutAndRetrieveMultipleItems(jayZ)
  })

  it("should return empty arrays when no models found when querying with jayZ", async () => {
    const jayZ = await createJayZ()
    await testEmptyQuery(jayZ)
  })

  it("should paginate query results with jayz", async () => {
    const jayZ = await createJayZ()
    await testQueryWithPaginatedResults(jayZ)
  })

  it("should query for only single type of model with jayZ", async () => {
    const jayZ = await createJayZ()
    await testQueryForSingleTypeOfModel(jayZ)
  })

  it("should filter items when querying with jayZ", async () => {
    const jayZ = await createJayZ()
    await testQueryWithFilter(jayZ)
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

  it("should write multiple items at once with jayZ", async () => {
    const jayZ = await createJayZ()
    await testBatchWriteWithTransaction(jayZ)
  })

  it("should query with multiple attribute filters with JayZ", async () => {
    const jayZ = await createJayZ()
    await testQueryWithCombinedAttributeFilters(jayZ)
  })

  it("should set maxRecordsToProcess with JayZ", async () => {
    const jayZ = await createJayZ()
    await testQueryWithLimit(jayZ)
  })

  it("should find the highest sort key with JayZ", async () => {
    const jayZ = await createJayZ()
    await testQueryWithReverseAndLimit(jayZ)
  })
})

async function testPutAndRetrieveItem(jayZ?: JayZ) {
  const db = await setup(jayZ)
  const [musician, _, __] = aMusicianWithTwoSongs()
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

async function testPutAndRetrieveMultipleItems(jayZ?: JayZ) {
  const db = await setup(jayZ)
  const [musician, song1, song2] = aMusicianWithTwoSongs()
  await db.batchPutWithTransaction({ items: [musician, song1, song2] })

  const result = await db
    .query(MusicianPartition.key({ id: musician.id }))
    .exec()
  expect(result).toEqual({ musician: [musician], song: [song1, song2] })
}

async function testEmptyQuery(jayZ?: JayZ) {
  const db = await setup(jayZ)
  const result = await db.query(MusicianPartition.key({ id: "foo-1" })).exec()
  expect(result).toEqual({ musician: [], song: [] })
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
    sortKey: "sortKey-123",
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
    timestamp: "456",
  })
  await db.put(model)

  const result = await db.get(
    LineItemModel.key({ id: "l1", orderId: "o1", timestamp: "456" })
  )
  expect(result).toEqual(model)
}

async function testQueryWithPaginatedResults(jayZ?: JayZ) {
  const db = await setup(jayZ)

  // DynamoDB has a 400kb Item limit w/ a 1MB response size limit
  // Thus the following items comprise at least 100kb * 25 = ~2.5MB of data
  // i.e. at least 3 pages. Note that data encrypted with JayZ is significantly larger
  const mp3 = crypto.randomBytes(100_000)
  const songs: Song[] = [...Array(25).keys()].map((songId) =>
    SongModel.create({
      musicianId: "1",
      id: songId.toString(),
      title: `Song ${songId}`,
      mp3,
    })
  )

  await Promise.all(songs.map((song) => db.put(song)))

  const results = await db.query(MusicianPartition.key({ id: "1" })).exec()
  expect(results.song.length).toEqual(songs.length)
}

async function testQueryWithFilter(jayZ?: JayZ) {
  const db = await setup(jayZ)
  const [musician, song1, song2] = aMusicianWithTwoSongs()
  await Promise.all([db.put(musician), db.put(song1), db.put(song2)])

  const result = await db
    .query(MusicianPartition.key({ id: musician.id }))
    .where("model", "=", ModelType.Song)
    .exec()

  expect(result).toEqual({ musician: [], song: [song1, song2] })
}

async function testQueryForSingleTypeOfModel(jayZ?: JayZ) {
  const db = await setup(jayZ)
  const [musician, song1, song2] = aMusicianWithTwoSongs()
  await Promise.all([db.put(musician), db.put(song1), db.put(song2)])

  const result = await db
    .query(SongModel.partitionKey({ musicianId: musician.id }))
    .exec()

  expect(result).toEqual({ song: [song1, song2] })
}

async function testQueryWithCombinedAttributeFilters(jayZ?: JayZ) {
  const db = await setup(jayZ)
  const [musician, song1, song2] = aMusicianWithTwoSongs()
  await Promise.all([db.put(musician), db.put(song1), db.put(song2)])

  const result = await db
    .query(MusicianPartition.key({ id: musician.id }))
    .attributeExists("model")
    .andAttributeExists("musicianId")
    .orAttributeNotExists("musicianId")
    .orAttributeExists("mp3")
    .orAttributeNotExists("mp3")
    .exec()

  expect(result).toEqual({ musician: [musician], song: [song1, song2] })
}

async function testQueryWithLimit(jayZ?: JayZ) {
  const db = await setup(jayZ)
  const [musician, song1, song2] = aMusicianWithTwoSongs()
  await Promise.all([db.put(musician), db.put(song1), db.put(song2)])

  const { value: response1 } = await db
    .query(MusicianPartition.key({ id: musician.id }))
    .iterator({ pageSize: 1 })
    .next()

  expect(response1.items).toEqual({ musician: [musician], song: [] })

  const { value: response2 } = await db
    .query(MusicianPartition.key({ id: musician.id }))
    .iterator({
      cursor: response1.cursor,
      pageSize: 1,
    })
    .next()

  expect(response2.items).toEqual({ musician: [], song: [song1] })
}

async function testQueryWithReverseAndLimit(jayZ?: JayZ) {
  const db = await setup(jayZ)
  const [_, song1, song2] = aMusicianWithTwoSongs()
  await Promise.all([db.put(song1), db.put(song2)])

  const { value, done } = await db
    .query(MusicianPartition.key({ id: song1.musicianId }))
    .reverse()
    .iterator({ pageSize: 1 })
    .next()

  expect(value.items).toEqual({ musician: [], song: [song2] })
}

async function testBatchGet(jayZ?: JayZ) {
  const db = await setup(jayZ)

  const [musician, song1, song2] = aMusicianWithTwoSongs()
  await Promise.all([db.put(musician), db.put(song1), db.put(song2)])

  const results = await db.batchGet({
    keys: [
      MusicianModel.key({ id: musician.id }),
      SongModel.key({ musicianId: musician.id, id: song1.id }),
      SongModel.key({ musicianId: musician.id, id: song2.id }),
    ],
  })

  sortById(results.song)
  expect(results).toEqual({
    musician: [musician],
    song: [song1, song2],
  })
}

async function testEmptyBatchGet(jayZ?: JayZ) {
  const db = await setup(jayZ)
  const [musician, song1, song2] = aMusicianWithTwoSongs()
  const results = await db.batchGet({
    keys: [
      MusicianModel.key({ id: musician.id }),
      SongModel.key({ musicianId: musician.id, id: song1.id }),
      SongModel.key({ musicianId: musician.id, id: song2.id }),
    ],
  })

  expect(results).toEqual({
    musician: [],
    song: [],
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
    details: {
      description: "famous guitarist",
    },
  })

  const slash = MusicianModel.create({
    id: "2",
    name: "Slash",
    details: {
      description: "another famous guitarist",
    },
  })

  const santanasSong = SongModel.create({
    musicianId: santana.id,
    id: "1",
    title: "A song where Slash and Santana play together",
    mp3: Buffer.from("fake-data", "utf8"),
  })

  const slashesSong = SongModel.create({
    musicianId: slash.id,
    id: "1", // note the same id as above
    title: "A song where Slash and Santana play together",
    mp3: Buffer.from("fake-data", "utf8"),
  })

  await db.batchPutWithTransaction({
    items: [santana, slash, santanasSong, slashesSong],
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
  await db.batchPutWithTransaction({ items: [musician, song1, song2] })

  const results = await db
    .query(MusicianPartition.key({ id: musician.id }))
    .exec()

  sortById(results.song)
  expect(results).toEqual({
    musician: [musician],
    song: [song1, song2],
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

async function createJayZ(): Promise<JayZ> {
  const keyProvider = await FixedDataKeyProvider.forLibsodium()
  return new JayZ({ keyProvider })
}
