import { JayZ } from "@ginger.io/jay-z"
import crypto from "crypto"
import { aMusicianWithTwoSongs, ModelType, Song, SongModel } from "./models"
import { createJayZ, createSongs, setup } from "./util"

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

  it("should scan with multiple attribute filters", async () => {
    await testScanWithCombinedAttributeFilters()
  })

  it("should scan with a user specified limit", async () => {
    await testScanWithLimit()
  })

  it("should parallel scan", async () => {
    await testParallelScan()
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
})

async function testEmptyScan(jayZ?: JayZ) {
  const db = await setup(jayZ)
  const result = await db.scan().exec()
  expect(result).toEqual({ musician: [], song: [] })
}

async function testScanWithPaginatedResults(jayZ?: JayZ) {
  const db = await setup(jayZ)
  const songs = await createSongs(db)
  const results = await db.scan().exec()
  expect(results.song.length).toEqual(songs.length)
}

async function testParallelScan(jayZ?: JayZ) {
  const db = await setup(jayZ)
  const songs = await createSongs(db)

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
      pageSize: 1,
    })
    .next()

  expect(response2.items).toEqual({ musician: [], song: [song1] })
}
