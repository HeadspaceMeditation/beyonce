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
  table
} from "./models"
import { setup } from "./util"

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

    const updated = await db.update(MusicianModel.key({ id: musician.id }), (musician) => {
      musician.name = "Gary Moore"
    })

    expect(updated).toEqual({ ...musician, name: "Gary Moore" })

    const reRead = await db.get(MusicianModel.key({ id: musician.id }))
    expect(reRead).toEqual({ ...musician, name: "Gary Moore" })
  })

  it("should update a nested item attribute", async () => {
    const db = await setup()
    const [musician, _, __] = aMusicianWithTwoSongs()
    await db.put(musician)

    const updated = await db.update(MusicianModel.key({ id: musician.id }), (musician) => {
      musician.details.description = "scottish blues dude"
    })

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

    const updated = await db.update(MusicianModel.key({ id: musician.id }), (musician) => {
      delete musician.details.description
    })

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

  it("should batchGet items with duplicate keys", async () => {
    await testBatchGetWithDuplicateKeys()
  })

  it("should batchGet more than 100 items by chunking requests", async () => {
    await testChunkedBatchGet()
  })

  it("should batchGet items and return unprocessedKeys", async () => {
    await testBatchGetWithUnprocessedKeys()
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

  it("should write multiple items with empty fields at once", async () => {
    await testPutAndRetrieveForItemWithEmptyFields()
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

  it("should cancel the transaction if matching record exists when failIfNotUnique is true on put", async () => {
    const db = await setup()
    const [musician, song1] = aMusicianWithTwoSongs()
    await db.batchWriteWithTransaction({ putItems: [musician, song1] })

    // Putting the same items again should succeed.
    await db.batchWriteWithTransaction({ putItems: [musician, song1] })

    // Putting the same items with `failIfNotUnique: true` cancels the transaction.
    await expect(
      db.batchWriteWithTransaction({
        putItems: [
          { ...musician, name: "updated" },
          { ...song1, name: "updated", failIfNotUnique: true }
        ]
      })
    ).rejects.toThrowError("ConditionalCheckFailed")

    const results = await db.query(MusicianPartition.key({ id: musician.id })).exec()

    // The original name of the musician and song should still be saved.
    sortById(results.song)
    expect(results).toEqual({
      musician: [musician],
      song: [song1]
    })
  })

  it("should write multiple items at once ", async () => {
    await testBatchWrite()
  })
})

async function testPutAndRetrieveItem() {
  const db = await setup()
  const [musician, _, __] = aMusicianWithTwoSongs()
  await db.put(musician)

  const result = await db.get(MusicianModel.key({ id: musician.id }))
  expect(result).toEqual(musician)
}

async function testPutAndRetrieveForItemWithEmptyFields() {
  const db = await setup()
  const [musician, song1, song2] = aMusicianWithTwoSongs()
  song1.genre = undefined
  song2.genre = null
  await db.batchWrite({ putItems: [musician, song1, song2] })

  const result = await db.get(MusicianModel.key({ id: musician.id }))
  expect(await db.get(SongModel.key({ musicianId: musician.id, id: song1.id }))).toEqual(song1)
  expect(await db.get(SongModel.key({ musicianId: musician.id, id: song2.id }))).toEqual(song2)
}

async function testPutAndRetrieveItemWithUndefinedField() {
  const db = await setup()
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

async function testPutAndDeleteItem() {
  const db = await setup()
  const [musician, _, __] = aMusicianWithTwoSongs()
  await db.put(musician)

  const key = MusicianModel.key({ id: musician.id })

  expect(await db.get(key)).toEqual(musician)
  await db.delete(key)
  expect(await db.get(key)).toEqual(undefined)
}

async function testPutAndDeleteItemInTransaction() {
  const db = await setup()
  const [musician, song1, song2] = aMusicianWithTwoSongs()
  await db.batchWriteWithTransaction({ putItems: [musician, song1] })

  await db.batchWriteWithTransaction({
    putItems: [song2],
    deleteItems: [SongModel.key({ musicianId: song1.musicianId, id: song1.id })]
  })

  expect(await db.get(SongModel.key({ musicianId: song2.musicianId, id: song2.id }))).toEqual(song2)

  expect(await db.get(SongModel.key({ musicianId: song1.musicianId, id: song1.id }))).toEqual(undefined)
}

async function testPutAndRetrieveCompoundPartitionKey() {
  interface Person {
    model: "person"
    first: string
    last: string
    sortKey: string
  }

  const PersonModel = table.model<Person>("person").partitionKey("Person", "first", "last").sortKey("Person", "sortKey")

  const db = await setup()
  const model = PersonModel.create({
    first: "Bob",
    last: "Smith",
    sortKey: "sortKey-123"
  })
  await db.put(model)

  const result = await db.get(PersonModel.key({ first: "Bob", last: "Smith", sortKey: "sortKey-123" }))

  expect(result).toEqual(model)
}

async function testPutAndRetrieveCompoundSortKey() {
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

  const db = await setup()
  const model = LineItemModel.create({
    id: "l1",
    orderId: "o1",
    timestamp: "456"
  })
  await db.put(model)

  const result = await db.get(LineItemModel.key({ id: "l1", orderId: "o1", timestamp: "456" }))
  expect(result).toEqual(model)
}

async function testBatchGet() {
  const db = await setup()

  const [musician, song1, song2] = aMusicianWithTwoSongs()
  await Promise.all([db.put(musician), db.put(song1), db.put(song2)])

  const results = await db.batchGet({
    keys: [
      MusicianModel.key({ id: musician.id }),
      SongModel.key({ musicianId: musician.id, id: song1.id }),
      SongModel.key({ musicianId: musician.id, id: song2.id })
    ]
  })

  sortById(results.items.song)
  expect(results.items).toEqual({
    musician: [musician],
    song: [song1, song2]
  })

  expect(results.unprocessedKeys).toEqual([])
}

async function testBatchGetWithDuplicateKeys() {
  const db = await setup()

  const [musician, song1, song2] = aMusicianWithTwoSongs()
  await Promise.all([db.put(musician), db.put(song1), db.put(song2)])

  const results = await db.batchGet({
    keys: [
      MusicianModel.key({ id: musician.id }),
      SongModel.key({ musicianId: musician.id, id: song1.id }),
      SongModel.key({ musicianId: musician.id, id: song2.id }),
      SongModel.key({ musicianId: musician.id, id: song2.id })
    ]
  })

  sortById(results.items.song)
  expect(results.items).toEqual({
    musician: [musician],
    song: [song1, song2]
  })

  expect(results.unprocessedKeys).toEqual([])
}

async function testChunkedBatchGet() {
  const db = await setup()
  const mp3 = crypto.randomBytes(1)
  const songs: Song[] = [...Array(150).keys()].map((songId) =>
    SongModel.create({
      musicianId: "1",
      id: songId.toString().padStart(3, "0"),
      title: `Song ${songId}`,
      mp3
    })
  )

  await Promise.all([
    db.batchWrite({ putItems: songs.slice(0, 20) }),
    db.batchWrite({ putItems: songs.slice(20, 40) }),
    db.batchWrite({ putItems: songs.slice(40, 60) }),
    db.batchWrite({ putItems: songs.slice(60, 80) }),
    db.batchWrite({ putItems: songs.slice(80, 100) }),
    db.batchWrite({ putItems: songs.slice(100, 120) }),
    db.batchWrite({ putItems: songs.slice(120, 140) }),
    db.batchWrite({ putItems: songs.slice(140, 150) })
  ])

  const results = await db.batchGet({
    keys: songs.map(({ id, musicianId }) => SongModel.key({ id, musicianId }))
  })

  expect(sortById(results.items.song)).toEqual(songs)
  expect(results.unprocessedKeys).toEqual([])
}

async function testBatchGetWithUnprocessedKeys() {
  const db = await setup()

  // Assume every "song" is ~400KB
  const mp3 = crypto.randomBytes(400_000)
  const songs: Song[] = [...Array(50).keys()].map((songId) =>
    SongModel.create({
      musicianId: "1",
      id: songId.toString(),
      title: `Song ${songId}`,
      mp3
    })
  )
  await Promise.all([db.batchWrite({ putItems: songs.slice(0, 25) }), db.batchWrite({ putItems: songs.slice(25, 50) })])

  // DynamoDB can retrieve 16MB of data per batchGet
  // so 16MB / ~400KB = ~40 items returned in a single batchGet call
  const results1 = await db.batchGet({
    keys: songs.map((s) => SongModel.key({ id: s.id, musicianId: s.musicianId }))
  })

  // So we have some leftover to retreive
  expect(results1.unprocessedKeys.length).toBeGreaterThan(0)

  // And then if we do 1 more batchGet, we should get all of them
  const results2 = await db.batchGet({ keys: results1.unprocessedKeys })
  const retrievedSongs = [...results1.items.song, ...results2.items.song]
  expect(retrievedSongs.length).toEqual(50)
}

async function testEmptyBatchGet() {
  const db = await setup()
  const [musician, song1, song2] = aMusicianWithTwoSongs()
  const results = await db.batchGet({
    keys: [
      MusicianModel.key({ id: musician.id }),
      SongModel.key({ musicianId: musician.id, id: song1.id }),
      SongModel.key({ musicianId: musician.id, id: song2.id })
    ]
  })

  expect(results.items).toEqual({
    musician: [],
    song: []
  })
}

async function testGSIByModel() {
  const db = await setup()
  const [musician, song1, song2] = aMusicianWithTwoSongs()
  await Promise.all([db.put(musician), db.put(song1), db.put(song2)])

  const result = await db.queryGSI(byModelAndIdGSI.name, byModelAndIdGSI.key(ModelType.Song)).exec()

  expect(result).toEqual({ musician: [], song: [song1, song2] })
}

async function testInvertedIndexGSI() {
  const db = await setup()

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

  await db.batchWriteWithTransaction({
    putItems: [santana, slash, santanasSong, slashesSong]
  })

  // Now when we query our inverted index, pk and sk are reversed,
  // so song id: 1 => [santanasSong, slashesSong]
  const { song: songs } = await db.queryGSI(invertedIndexGSI.name, invertedIndexGSI.key(`${ModelType.Song}-1`)).exec()

  expect(songs).toEqual([santanasSong, slashesSong])
}

async function testBatchWriteWithTransaction() {
  const db = await setup()
  const [musician, song1, song2] = aMusicianWithTwoSongs()
  await db.batchWriteWithTransaction({ putItems: [musician, song1, song2] })

  const results = await db.query(MusicianPartition.key({ id: musician.id })).exec()

  sortById(results.song)
  expect(results).toEqual({
    musician: [musician],
    song: [song1, song2]
  })
}

async function testBatchWrite() {
  const db = await setup()
  const [musician, song1, song2] = aMusicianWithTwoSongs()
  await db.put(song2)
  await db.batchWrite({
    putItems: [musician, song1],
    deleteItems: [SongModel.key({ id: song2.id, musicianId: song2.musicianId })]
  })

  const results = await db.query(MusicianPartition.key({ id: musician.id })).exec()

  sortById(results.song)
  expect(results).toEqual({
    musician: [musician],
    song: [song1]
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
