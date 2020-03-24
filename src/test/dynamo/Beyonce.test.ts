import { JayZ, StubDataKeyProvider } from "@ginger.io/jay-z"
import {
  aMusicianWithTwoSongs,
  PK,
  putMusician,
  putSong,
  setup,
  SK,
  GSIs,
  ModelType
} from "./util"

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

  // With JayZ encryption
  it("should put and retrieve an item using pk + sk with jayZ", async () => {
    const keyProvider = await StubDataKeyProvider.forLibsodium()
    const jayZ = new JayZ({ keyProvider })
    await testPutAndRetrieveItem(jayZ)
  })

  it("should put and retrieve multiple items using just pk with jayZ", async () => {
    const keyProvider = await StubDataKeyProvider.forLibsodium()
    const jayZ = new JayZ({ keyProvider })
    await testPutAndRetrieveMultipleItems(jayZ)
  })

  it("should filter items when querying with jayZ", async () => {
    const keyProvider = await StubDataKeyProvider.forLibsodium()
    const jayZ = new JayZ({ keyProvider })
    await testQueryWithFilter(jayZ)
  })

  it("should batchGet items with jayZ", async () => {
    const keyProvider = await StubDataKeyProvider.forLibsodium()
    const jayZ = new JayZ({ keyProvider })
    await testBatchGet(jayZ)
  })

  it("should query GSI by model with jayZ", async () => {
    const keyProvider = await StubDataKeyProvider.forLibsodium()
    const jayZ = new JayZ({ keyProvider })
    await testGSIByModel(jayZ)
  })

  it("should query GSI by name with jayZ", async () => {
    const keyProvider = await StubDataKeyProvider.forLibsodium()
    const jayZ = new JayZ({ keyProvider })
    await testGSIByName(jayZ)
  })
})

async function testPutAndRetrieveItem(jayZ?: JayZ) {
  const db = await setup(jayZ)
  const [musician, _, __] = aMusicianWithTwoSongs()

  await putMusician(db, musician)

  const result = await db.get({
    partition: PK.Musician({ musicianId: "1" }),
    sort: SK.Musician({ musicianId: "1" })
  })

  expect(result).toEqual(musician)
}

async function testPutAndRetrieveMultipleItems(jayZ?: JayZ) {
  const db = await setup()
  const [musician, song1, song2] = aMusicianWithTwoSongs()

  await Promise.all([
    putMusician(db, musician),
    putSong(db, song1),
    putSong(db, song2)
  ])

  const result = await db.query(PK.Musician({ musicianId: "1" })).exec()
  expect(result).toEqual([musician, song1, song2])
}

async function testQueryWithFilter(jayZ?: JayZ) {
  const db = await setup()
  const [musician, song1, song2] = aMusicianWithTwoSongs()

  await Promise.all([
    putMusician(db, musician),
    putSong(db, song1),
    putSong(db, song2)
  ])

  const result = await db
    .query(PK.Musician({ musicianId: "1" }))
    .attributeNotExists("title")
    .or("title", "=", "Buffalo Soldier")
    .exec()

  expect(result).toEqual([musician, song1])
}

async function testBatchGet(jayZ?: JayZ) {
  const db = await setup()
  const [musician, song1, song2] = aMusicianWithTwoSongs()

  await Promise.all([
    putMusician(db, musician),
    putSong(db, song1),
    putSong(db, song2)
  ])

  const results = await db.batchGet({
    keys: [
      {
        partition: PK.Musician({ musicianId: "1" }),
        sort: SK.Musician({ musicianId: "1" })
      },
      {
        partition: PK.Musician({ musicianId: "1" }),
        sort: SK.Song({ songId: "2" })
      },
      {
        partition: PK.Musician({ musicianId: "1" }),
        sort: SK.Song({ songId: "3" })
      }
    ]
  })

  results.sort((a, b) => {
    if (a.id === b.id) {
      return 0
    } else if (a.id > b.id) {
      return 1
    } else {
      return -1
    }
  })

  expect(results).toEqual([musician, song1, song2])
}

async function testGSIByModel(jayZ?: JayZ) {
  const db = await setup(jayZ)
  const [musician, song1, song2] = aMusicianWithTwoSongs()

  await Promise.all([
    putMusician(db, musician),
    putSong(db, song1),
    putSong(db, song2)
  ])

  const result = await db
    .queryGSI(
      GSIs.byModelAndId.name,
      GSIs.byModelAndId.pk({ model: ModelType.SONG })
    )
    .exec()

  expect(result).toEqual([song1, song2])
}

async function testGSIByName(jayZ?: JayZ) {
  const db = await setup(jayZ)
  const [musician, song1, song2] = aMusicianWithTwoSongs()

  await Promise.all([
    putMusician(db, musician),
    putSong(db, song1),
    putSong(db, song2)
  ])

  const result = await db
    .queryGSI(
      GSIs.byNameAndId.name,
      GSIs.byNameAndId.pk({ name: musician.name })
    )
    .exec()

  expect(result).toEqual([musician])
}
