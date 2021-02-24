import { JayZ } from "@ginger.io/jay-z"
import {
  aMusicianWithTwoSongs,
  ModelType,
  Musician,
  MusicianModel,
  MusicianPartition,
  Song,
  SongModel
} from "./models"
import { createJayZ, create25Songs, setup } from "./util"

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

  it("should filter and paginate query results", async () => {
    await testPaginatedQueryWithFilter()
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

  it("should put and retrieve multiple items using just pk", async () => {
    await testPutAndRetrieveMultipleItems()
  })
})

describe("Beyonce.query with JayZ", () => {
  it("should return empty arrays when no models found when querying", async () => {
    const jayz = await createJayZ()
    await testEmptyQuery(jayz)
  })

  it("should set consistent read on queries", async () => {
    const jayz = await createJayZ()
    const db = await setup(jayz)
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
    const jayz = await createJayZ()
    await testQueryForSingleTypeOfModel(jayz)
  })

  it("should filter items when querying", async () => {
    const jayz = await createJayZ()
    await testQueryWithFilter(jayz)
  })

  it("should paginate query results", async () => {
    const jayz = await createJayZ()
    await testQueryWithPaginatedResults(jayz)
  })

  it("should filter and paginate query results", async () => {
    const jayz = await createJayZ()
    await testPaginatedQueryWithFilter(jayz)
  })

  it("should query with multiple attribute filters", async () => {
    const jayz = await createJayZ()
    await testQueryWithCombinedAttributeFilters(jayz)
  })

  it("should set maxRecordsToProcess", async () => {
    const jayz = await createJayZ()
    await testQueryWithLimit(jayz)
  })

  it("should find the highest sort key", async () => {
    const jayz = await createJayZ()
    await testQueryWithReverseAndLimit(jayz)
  })

  it("should put and retrieve multiple items using just pk", async () => {
    const jayz = await createJayZ()
    await testPutAndRetrieveMultipleItems(jayz)
  })
})

async function testEmptyQuery(jayZ?: JayZ) {
  const db = await setup(jayZ)
  const result = await db.query(MusicianPartition.key({ id: "foo-1" })).exec()
  expect(result).toEqual({ musician: [], song: [] })
}

async function testQueryWithPaginatedResults(jayZ?: JayZ) {
  const db = await setup(jayZ)
  const songs = await create25Songs(db)
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

async function testPaginatedQueryWithFilter(jayZ?: JayZ) {
  const db = await setup(jayZ)
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

  expect(result).toEqual({
    musician: [musician],
    song: [song1, song2]
  })
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
      pageSize: 1
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

async function testPutAndRetrieveMultipleItems(jayZ?: JayZ) {
  const db = await setup(jayZ)
  const [musician, song1, song2] = aMusicianWithTwoSongs()
  await db.executeTransaction({ putItems: [musician, song1, song2] })

  const result = await db
    .query(MusicianPartition.key({ id: musician.id }))
    .exec()
  expect(result).toEqual({
    musician: [musician],
    song: [song1, song2]
  })
}
