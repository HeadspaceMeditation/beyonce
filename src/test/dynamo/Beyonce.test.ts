import { JayZ, FixedDataKeyProvider } from "@ginger.io/jay-z"
import crypto from "crypto"
import {
  aMusicianWithTwoSongs,
  byModelAndIdGSI,
  byNameAndIdGSI,
  ModelType,
  MusicianModel,
  MusicianPartition,
  Song,
  SongModel,
} from "./models"
import { setup } from "./util"

describe("Beyonce", () => {
  // Without encryption
  it("should put and retrieve an item using pk + sk", async () => {
    await testPutAndRetrieveItem()
  })

  it("should put and retrieve multiple items using just pk", async () => {
    await testPutAndRetrieveMultipleItems()
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

  // GSIs
  it("should query GSI by model", async () => {
    await testGSIByModel()
  })

  it("should query GSI by name", async () => {
    await testGSIByName()
  })

  it("should write multiple items at once", async () => {
    await testBatchWriteWithTransaction()
  })

  // With JayZ encryption
  it("should put and retrieve an item using pk + sk with jayZ", async () => {
    const jayZ = await createJayZ()
    await testPutAndRetrieveItem(jayZ)
  })

  it("should put and retrieve multiple items using just pk with jayZ", async () => {
    const jayZ = await createJayZ()
    await testPutAndRetrieveMultipleItems(jayZ)
  })

  it("should paginate query results with jayz", async () => {
    const jayZ = await createJayZ()
    await testQueryWithPaginatedResults(jayZ)
  })

  it("should filter items when querying with jayZ", async () => {
    const jayZ = await createJayZ()
    await testQueryWithFilter(jayZ)
  })

  it("should batchGet items with jayZ", async () => {
    const jayZ = await createJayZ()
    await testBatchGet(jayZ)
  })

  it("should query GSI by model with jayZ", async () => {
    const jayZ = await createJayZ()
    await testGSIByModel(jayZ)
  })

  it("should query GSI by name with jayZ", async () => {
    const jayZ = await createJayZ()
    await testGSIByName(jayZ)
  })

  it("should write multiple items at once with jayZ", async () => {
    const jayZ = await createJayZ()
    await testBatchWriteWithTransaction(jayZ)
  })
})

async function testPutAndRetrieveItem(jayZ?: JayZ) {
  const db = await setup(jayZ)
  const [musician, _, __] = aMusicianWithTwoSongs()

  await db.put(musician)

  const result = await db.get(MusicianModel.key({ id: musician.id }))
  expect(result).toEqual(musician)
}

async function testPutAndRetrieveMultipleItems(jayZ?: JayZ) {
  const db = await setup(jayZ)
  const [musician, song1, song2] = aMusicianWithTwoSongs()

  await Promise.all([db.put(musician), db.put(song1), db.put(song2)])

  const result = await db.query(MusicianModel.key({ id: musician.id })).exec()
  expect(result).toEqual([musician, song1, song2])
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
  expect(results.length).toEqual(songs.length)
}

async function testQueryWithFilter(jayZ?: JayZ) {
  const db = await setup(jayZ)
  const [musician, song1, song2] = aMusicianWithTwoSongs()

  await Promise.all([db.put(musician), db.put(song1), db.put(song2)])

  const result = await db
    .query(MusicianPartition.key({ id: musician.id }))
    .where("model", "=", ModelType.Song)
    .exec()

  expect(result).toEqual([song1, song2])
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

  sortById(results)
  expect(results).toEqual([musician, song1, song2])
}

async function testGSIByModel(jayZ?: JayZ) {
  const db = await setup(jayZ)
  const [musician, song1, song2] = aMusicianWithTwoSongs()

  await Promise.all([db.put(musician), db.put(song1), db.put(song2)])

  const result = await db
    .queryGSI(byModelAndIdGSI.name, byModelAndIdGSI.key(ModelType.Song))
    .exec()

  expect(result).toEqual([song1, song2])
}

async function testGSIByName(jayZ?: JayZ) {
  const db = await setup(jayZ)
  const [musician, song1, song2] = aMusicianWithTwoSongs()

  await Promise.all([db.put(musician), db.put(song1), db.put(song2)])

  const result = await db
    .queryGSI(byNameAndIdGSI.name, byNameAndIdGSI.key(musician.name))
    .exec()

  expect(result).toEqual([musician])
}

async function testBatchWriteWithTransaction(jayZ?: JayZ) {
  const db = await setup(jayZ)
  const [musician, song1, song2] = aMusicianWithTwoSongs()

  await db.batchPutWithTransaction({ items: [musician, song1, song2] })

  const results = await db
    .query(MusicianPartition.key({ id: musician.id }))
    .exec()

  sortById(results)
  expect(results).toEqual([musician, song1, song2])
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
