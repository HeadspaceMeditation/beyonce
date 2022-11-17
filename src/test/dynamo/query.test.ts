import {
  aMusicianWithTwoSongs,
  aSong,
  ModelType,
  Musician,
  MusicianModel,
  MusicianPartition,
  Song,
  SongModel
} from "./models"
import { create25Songs, setup } from "./util"

describe("Beyonce.query", () => {
  it("should return empty arrays when no models found when querying", async () => {
    await testEmptyQuery()
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

  it("should query for only single type of model", async () => {
    await testQueryForSingleTypeOfModel()
  })

  it("should filter items when querying", async () => {
    await testQueryWithFilter()
  })

  it("should paginate query results", async () => {
    await testQueryWithPaginatedResults()
  })

  it("should paginate query results in sorted order", async () => {
    await testQueryWithSortedPaginatedResults()
  })

  it("should filter and paginate query results", async () => {
    await testPaginatedQueryWithFilter()
  })

  it("should query with multiple attribute filters", async () => {
    await testQueryWithCombinedAttributeFilters()
  })

  it("should set maxRecordsToProcess", async () => {
    await testQueryWithLimit()
  })

  it("should return undefined cursor when there are no more records to query", async () => {
    await testPaginatedQueryReturnUndefinedCursor()
  })

  it("should find the highest sort key", async () => {
    await testQueryWithReverseAndLimit()
  })

  it("should put and retrieve multiple items using just pk", async () => {
    await testPutAndRetrieveMultipleItems()
  })
})

async function testEmptyQuery() {
  const db = await setup()
  const result = await db.query(MusicianPartition.key({ id: "foo-1" })).exec()
  expect(result).toEqual({ musician: [], song: [] })
}

async function testQueryWithPaginatedResults() {
  const db = await setup()
  const songs = await create25Songs(db)
  const results = await db.query(MusicianPartition.key({ id: "1" })).exec()
  expect(results.song.length).toEqual(songs.length)
}

async function testQueryWithSortedPaginatedResults() {
  const db = await setup()
  const song1 = aSong({ musicianId: "1", id: `${new Date("1/1/2000").toISOString()}` })
  const song2 = aSong({ musicianId: "1", id: `${new Date("1/2/2000").toISOString()}` })
  const song3 = aSong({ musicianId: "1", id: `${new Date("1/3/2000").toISOString()}` })
  const song4 = aSong({ musicianId: "1", id: `${new Date("1/4/2000").toISOString()}` })
  const song5 = aSong({ musicianId: "1", id: `${new Date("1/5/2000").toISOString()}` })
  await db.batchWrite({ putItems: [song1, song2, song3, song4, song5] })

  const results = await db
    .query(MusicianPartition.key({ id: "1" }))
    .reverse()
    .iterator()
    .next()

  expect(results.value.items.song).toEqual([song5, song4, song3, song2, song1])
}

async function testQueryWithFilter() {
  const db = await setup()
  const [musician, song1, song2] = aMusicianWithTwoSongs()
  await Promise.all([db.put(musician), db.put(song1), db.put(song2)])

  const result = await db
    .query(MusicianPartition.key({ id: musician.id }))
    .where("model", "=", ModelType.Song)
    .exec()

  expect(result).toEqual({ musician: [], song: [song1, song2] })
}

async function testPaginatedQueryWithFilter() {
  const db = await setup()
  await create25Songs(db)
  const musician = MusicianModel.create({
    id: "1",
    name: "ZZ Top",
    divaRating: 10,
    details: {}
  })
  await db.put(musician)

  const iterator = db
    .query(MusicianPartition.key({ id: musician.id }))
    .where("model", "=", ModelType.Musician)
    .iterator()

  const musiciansProcessed: Musician[] = []
  const songsProcessed: Song[] = []
  for await (const { items } of iterator) {
    musiciansProcessed.push(...items.musician)
    songsProcessed.push(...items.song)
  }

  expect(musiciansProcessed).toEqual([musician])
  expect(songsProcessed.length).toEqual(0)
}

async function testQueryForSingleTypeOfModel() {
  const db = await setup()
  const [musician, song1, song2] = aMusicianWithTwoSongs()
  await Promise.all([db.put(musician), db.put(song1), db.put(song2)])

  const result = await db.query(SongModel.partitionKey({ musicianId: musician.id })).exec()

  expect(result).toEqual({ song: [song1, song2] })
}

async function testQueryWithCombinedAttributeFilters() {
  const db = await setup()
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

  expect(result).toEqual({
    musician: [musician],
    song: [song1, song2]
  })
}

async function testQueryWithLimit() {
  const db = await setup()
  const [musician, song1, song2] = aMusicianWithTwoSongs()
  await Promise.all([db.put(musician), db.put(song1), db.put(song2)])
  const key = MusicianPartition.key({ id: musician.id })

  const { value: response1 } = await db.query(key).iterator({ pageSize: 1 }).next()

  expect(response1.items).toEqual({ musician: [musician], song: [] })

  const { value: response2 } = await db
    .query(key)
    .iterator({
      cursor: response1.cursor,
      pageSize: 1
    })
    .next()

  expect(response2.items).toEqual({ musician: [], song: [song1] })

  const { value: response3 } = await db
    .query(key)
    .iterator({
      cursor: response2.cursor,
      pageSize: 100
    })
    .next()

  expect(response3.items).toEqual({ musician: [], song: [song2] })
  expect(response3.cursor).toEqual(undefined)
}

async function testPaginatedQueryReturnUndefinedCursor() {
  const db = await setup()
  const [musician, song1, song2] = aMusicianWithTwoSongs()
  await Promise.all([db.put(musician), db.put(song1), db.put(song2)])

  const { value: response1 } = await db
    .query(MusicianPartition.key({ id: musician.id }))
    .iterator({ pageSize: 3 })
    .next()

  expect(response1.items).toEqual({
    musician: [musician],
    song: [song1, song2]
  })

  const { value: response2 } = await db
    .query(MusicianPartition.key({ id: musician.id }))
    .iterator({
      cursor: response1.cursor,
      pageSize: 1
    })
    .next()

  expect(response2.items).toEqual({ musician: [], song: [] })
  expect(response2.cursor).toBeUndefined()
}

async function testQueryWithReverseAndLimit() {
  const db = await setup()
  const [_, song1, song2] = aMusicianWithTwoSongs()
  await Promise.all([db.put(song1), db.put(song2)])

  const { value, done } = await db
    .query(MusicianPartition.key({ id: song1.musicianId }))
    .reverse()
    .iterator({ pageSize: 1 })
    .next()

  expect(value.items).toEqual({ musician: [], song: [song2] })
}

async function testPutAndRetrieveMultipleItems() {
  const db = await setup()
  const [musician, song1, song2] = aMusicianWithTwoSongs()
  await db.batchWriteWithTransaction({ putItems: [musician, song1, song2] })

  const result = await db.query(MusicianPartition.key({ id: musician.id })).exec()
  expect(result).toEqual({
    musician: [musician],
    song: [song1, song2]
  })
}
