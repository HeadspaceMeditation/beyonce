import { JayZ, StubDataKeyProvider } from "@ginger.io/jay-z"
import {
  aMusicianWithTwoSongs,
  byModelAndIdGSI,
  byNameAndIdGSI,
  ModelType,
  MusicianModel,
  MusicianPartition,
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
    const jayZ = await aJayZ()
    await testPutAndRetrieveItem(jayZ)
  })

  it("should put and retrieve multiple items using just pk with jayZ", async () => {
    const jayZ = await aJayZ()
    await testPutAndRetrieveMultipleItems(jayZ)
  })

  it("should filter items when querying with jayZ", async () => {
    const jayZ = await aJayZ()
    await testQueryWithFilter(jayZ)
  })

  it("should batchGet items with jayZ", async () => {
    const jayZ = await aJayZ()
    await testBatchGet(jayZ)
  })

  it("should query GSI by model with jayZ", async () => {
    const jayZ = await aJayZ()
    await testGSIByModel(jayZ)
  })

  it("should query GSI by name with jayZ", async () => {
    const jayZ = await aJayZ()
    await testGSIByName(jayZ)
  })

  it("should write multiple items at once with jayZ", async () => {
    const jayZ = await aJayZ()
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
  const db = await setup()
  const [musician, song1, song2] = aMusicianWithTwoSongs()

  await Promise.all([db.put(musician), db.put(song1), db.put(song2)])

  const result = await db.query(MusicianModel.key({ id: musician.id })).exec()
  expect(result).toEqual([musician, song1, song2])
}

async function testQueryWithFilter(jayZ?: JayZ) {
  const db = await setup()
  const [musician, song1, song2] = aMusicianWithTwoSongs()

  await Promise.all([db.put(musician), db.put(song1), db.put(song2)])

  const result = await db
    .query(MusicianPartition.key({ id: musician.id }))
    .attributeNotExists("title")
    .or("title", "=", "Buffalo Soldier")
    .exec()

  expect(result).toEqual([musician, song1])
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

async function aJayZ(): Promise<JayZ> {
  const keyProvider = await StubDataKeyProvider.forLibsodium()
  return new JayZ({ keyProvider })
}
