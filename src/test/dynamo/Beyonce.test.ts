import { JayZ, StubDataKeyProvider } from "@ginger.io/jay-z"
import {
  aMusicianWithTwoSongs,
  GSIs,
  ModelType,
  PK,
  putMusician,
  putSong,
  setup,
  SK,
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

  await putMusician(db, musician)

  const result = await db.get({
    partition: PK.Musician({ musicianId: "1" }),
    sort: SK.Musician({ musicianId: "1" }),
  })

  expect(result).toEqual(musician)
}

async function testPutAndRetrieveMultipleItems(jayZ?: JayZ) {
  const db = await setup()
  const [musician, song1, song2] = aMusicianWithTwoSongs()

  await Promise.all([
    putMusician(db, musician),
    putSong(db, song1),
    putSong(db, song2),
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
    putSong(db, song2),
  ])

  const result = await db
    .query(PK.Musician({ musicianId: "1" }))
    .attributeNotExists("title")
    .or("title", "=", "Buffalo Soldier")
    .exec()

  expect(result).toEqual([musician, song1])
}

async function testBatchGet(jayZ?: JayZ) {
  const db = await setup(jayZ)

  const [musician, song1, song2] = aMusicianWithTwoSongs()
  await Promise.all([
    putMusician(db, musician),
    putSong(db, song1),
    putSong(db, song2),
  ])

  const results = await db.batchGet({
    keys: [
      {
        partition: PK.Musician({ musicianId: musician.id }),
        sort: SK.Musician({ musicianId: musician.id }),
      },
      {
        partition: PK.Musician({ musicianId: musician.id }),
        sort: SK.Song({ songId: song1.id }),
      },
      {
        partition: PK.Musician({ musicianId: musician.id }),
        sort: SK.Song({ songId: song2.id }),
      },
    ],
  })

  sortById(results)
  expect(results).toEqual([musician, song1, song2])
}

async function testGSIByModel(jayZ?: JayZ) {
  const db = await setup(jayZ)
  const [musician, song1, song2] = aMusicianWithTwoSongs()

  await Promise.all([
    putMusician(db, musician),
    putSong(db, song1),
    putSong(db, song2),
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
    putSong(db, song2),
  ])

  const result = await db
    .queryGSI(
      GSIs.byNameAndId.name,
      GSIs.byNameAndId.pk({ name: musician.name })
    )
    .exec()

  expect(result).toEqual([musician])
}

async function testBatchWriteWithTransaction(jayZ?: JayZ) {
  const db = await setup(jayZ)
  const [musician, song1, song2] = aMusicianWithTwoSongs()
  const pk = PK.Musician({ musicianId: musician.id })

  await db.batchPutWithTransaction([
    {
      keys: {
        partition: pk,
        sort: SK.Musician({ musicianId: musician.id }),
      },
      item: musician,
    },

    {
      keys: {
        partition: pk,
        sort: SK.Song({ songId: song1.id }),
      },
      item: song1,
    },
    {
      keys: {
        partition: pk,
        sort: SK.Song({ songId: song2.id }),
      },

      item: song2,
    },
  ])

  const results = await db.query(pk).exec()
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
