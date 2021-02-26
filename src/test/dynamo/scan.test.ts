import { DataKeyProvider, JayZ } from "@ginger.io/jay-z"
import crypto from "crypto"
import { crypto_kdf_KEYBYTES, randombytes_buf } from "libsodium-wrappers"
import {
  aMusicianWithTwoSongs,
  ModelType,
  Musician,
  MusicianModel,
  Song,
  SongModel
} from "./models"
import {
  createBeyonce,
  createDynamoDB,
  createJayZ,
  create25Songs,
  setup
} from "./util"

describe("Beyonce.scan", () => {
  it("should return empty arrays when no models found during scan", async () => {
    await testEmptyScan()
  })

  it("should filter items during scan", async () => {
    await testScanWithFilter()
  })

  it("should paginate scan results", async () => {
    await testScanWithPaginatedResults()
  })

  it("should filter paginated scan results", async () => {
    await testScanWithFilteredPaginatedResults()
  })

  it("should scan with multiple attribute filters", async () => {
    await testScanWithCombinedAttributeFilters()
  })

  it("should scan with a user specified limit", async () => {
    await testScanWithLimit()
  })

  it("should parallel scan", async () => {
    await testParallelScan()
  })

  it("should return undefined cursor when there are no more records to scan", async () => {
    await testScanWithPaginatedResultsReturnUndefinedCursor()
  })
})

describe("Beyonce.scan with JayZ", () => {
  it("should return empty arrays when no models found when querying", async () => {
    const jayz = await createJayZ()
    await testEmptyScan(jayz)
  })

  it("should filter items during scan", async () => {
    const jayz = await createJayZ()
    await testScanWithFilter(jayz)
  })

  it("should paginate scan results", async () => {
    const jayz = await createJayZ()
    await testScanWithPaginatedResults(jayz)
  })

  it("should filter paginated scan results", async () => {
    const jayz = await createJayZ()
    await testScanWithFilteredPaginatedResults(jayz)
  })

  it("should scan with multiple attribute filters", async () => {
    const jayz = await createJayZ()
    await testScanWithCombinedAttributeFilters(jayz)
  })

  it("should scan with a user specified limit", async () => {
    const jayz = await createJayZ()
    await testScanWithLimit(jayz)
  })

  it("should parallel scan", async () => {
    const jayz = await createJayZ()
    await testParallelScan(jayz)
  })

  it("should not stop the iterator if an error occurs", async () => {
    const jayz = await createJayZ()
    // Given some songs encrypted correctly with JayZ
    const db = await setup(jayz)
    await create25Songs(db)

    // And one last song that is encrypted incorrectly (e.g. with a different key)
    const oneLastSong: Song = SongModel.create({
      musicianId: "1",
      id: "bad-song",
      title: `Bad song`,
      mp3: crypto.randomBytes(100_000)
    })

    const keyProvider: DataKeyProvider = {
      generateDataKey: async () => ({
        dataKey: randombytes_buf(crypto_kdf_KEYBYTES),
        encryptedDataKey: randombytes_buf(crypto_kdf_KEYBYTES)
      }),

      decryptDataKey: async (key) => key
    }

    const badBeyonce = createBeyonce(
      createDynamoDB(),
      new JayZ({ keyProvider })
    )

    await badBeyonce.put(oneLastSong)

    // Then we should still page through all the results, but collect the errors
    const songs: Song[] = []
    const errors: Error[] = []
    for await (const results of badBeyonce.scan<Song>().iterator()) {
      songs.push(...results.items.song)
      if (results.errors) {
        errors.push(...results.errors)
      }
    }

    expect(songs.length).toEqual(25)
    expect(errors).toEqual([
      new Error("wrong secret key for the given ciphertext")
    ])
  })

  it("should return undefined cursor when there are no more records to scan", async () => {
    const jayz = await createJayZ()
    await testScanWithPaginatedResultsReturnUndefinedCursor(jayz)
  })
})

async function testEmptyScan(jayZ?: JayZ) {
  const db = await setup(jayZ)
  const result = await db.scan().exec()
  expect(result).toEqual({ musician: [], song: [] })
}

async function testScanWithPaginatedResults(jayZ?: JayZ) {
  const db = await setup(jayZ)
  const songs = await create25Songs(db)
  const results = await db.scan().exec()
  expect(results.song.length).toEqual(songs.length)
}

async function testScanWithFilteredPaginatedResults(jayZ?: JayZ) {
  const db = await setup(jayZ)
  const songs = await create25Songs(db)
  const musician = MusicianModel.create({
    id: "zz-top",
    divaRating: 10,
    name: "ZZ Top",
    details: {}
  })

  await db.put(musician)

  const musiciansProcessed: Musician[] = []
  const songsProcessed: Song[] = []
  for await (const { items } of db
    .scan<Musician | Song>() // type-system hack so we can assert we don't get Songs in the results
    .where("model", "=", ModelType.Musician)
    .iterator()) {
    musiciansProcessed.push(...items.musician)
    songsProcessed.push(...items.song)
  }

  expect(musiciansProcessed).toEqual([musician])
  expect(songsProcessed.length).toEqual(0)
}

async function testParallelScan(jayZ?: JayZ) {
  const db = await setup(jayZ)
  const songs = await create25Songs(db)

  const segment1 = db
    .scan<Song>({ parallel: { segmentId: 0, totalSegments: 2 } })
    .iterator()

  const segment2 = db
    .scan<Song>({ parallel: { segmentId: 1, totalSegments: 2 } })
    .iterator()

  const results: Song[] = []

  for await (const { items } of segment1) {
    results.push(...items.song)
  }

  for await (const { items } of segment2) {
    results.push(...items.song)
  }

  expect(results.length).toEqual(songs.length)
}

async function testScanWithFilter(jayZ?: JayZ) {
  const db = await setup(jayZ)
  const [musician, song1, song2] = aMusicianWithTwoSongs()
  await Promise.all([db.put(musician), db.put(song1), db.put(song2)])

  const result = await db
    .scan()
    .where("model", "=", ModelType.Song)
    .exec()

  expect(result).toEqual({ musician: [], song: [song1, song2] })
}

async function testScanWithCombinedAttributeFilters(jayZ?: JayZ) {
  const db = await setup(jayZ)
  const [musician, song1, song2] = aMusicianWithTwoSongs()
  await Promise.all([db.put(musician), db.put(song1), db.put(song2)])

  const result = await db
    .scan()
    .attributeExists("model")
    .andAttributeExists("musicianId")
    .orAttributeNotExists("musicianId")
    .orAttributeExists("mp3")
    .orAttributeNotExists("mp3")
    .exec()

  expect(result).toEqual({ musician: [musician], song: [song1, song2] })
}

async function testScanWithLimit(jayZ?: JayZ) {
  const db = await setup(jayZ)
  const [musician, song1, song2] = aMusicianWithTwoSongs()
  await Promise.all([db.put(musician), db.put(song1), db.put(song2)])

  const { value: response1 } = await db
    .scan()
    .iterator({ pageSize: 1 })
    .next()

  expect(response1.items).toEqual({ musician: [musician], song: [] })

  const { value: response2 } = await db
    .scan()
    .iterator({
      cursor: response1.cursor,
      pageSize: 1
    })
    .next()

  expect(response2.items).toEqual({ musician: [], song: [song1] })
}

async function testScanWithPaginatedResultsReturnUndefinedCursor(jayZ?: JayZ) {
  const db = await setup(jayZ)
  const [musician, song1, song2] = aMusicianWithTwoSongs()
  await Promise.all([db.put(musician), db.put(song1), db.put(song2)])

  const { value: response1 } = await db.scan().iterator({ pageSize: 3 }).next()

  expect(response1.items).toEqual({
    musician: [musician],
    song: [song1, song2]
  })

  const { value: response2 } = await db
    .scan()
    .iterator({
      cursor: response1.cursor,
      pageSize: 1
    })
    .next()

  expect(response2.items).toEqual({ musician: [], song: [] })
  expect(response2.cursor).toBeUndefined()
}
