import { Table } from "../../main/dynamo/Table"

export const table = new Table({
  name: "TestTable",
  partitionKeyName: "pk",
  sortKeyName: "sk"
})

export enum ModelType {
  Musician = "musician",
  Song = "song"
}

export interface Musician {
  model: ModelType.Musician
  id: string
  name: string
  divaRating: number | undefined
  details: {
    description?: string
  }
}

export interface Song {
  model: ModelType.Song
  musicianId: string
  id: string
  title: string
  genre?: string | null
  mp3: Buffer
}

export const MusicianModel = table
  .model<Musician>(ModelType.Musician)
  .partitionKey(ModelType.Musician, "id")
  .sortKey(ModelType.Musician, "id")

export const SongModel = table
  .model<Song>(ModelType.Song)
  .partitionKey(ModelType.Musician, "musicianId")
  .sortKey(ModelType.Song, "id")

export const MusicianPartition = table.partition([MusicianModel, SongModel])

export const byModelAndIdGSI = table
  .gsi("byModelAndId")
  .models([MusicianModel, SongModel])
  .partitionKey("model")
  .sortKey("id")

export const invertedIndexGSI = table
  .gsi("invertedIndex")
  .models([MusicianModel, SongModel])
  .partitionKey("sk")
  .sortKey("pk")

export function aMusicianWithTwoSongs(): [Musician, Song, Song] {
  const musician = MusicianModel.create({
    id: "1",
    name: "Bob Marley",
    divaRating: 0,
    details: {
      description: "rasta man"
    }
  })

  const song1 = SongModel.create({
    musicianId: "1",
    id: "2",
    title: "Buffalo Soldier",
    mp3: Buffer.from("fake-data", "utf8")
  })

  const song2 = SongModel.create({
    musicianId: "1",
    id: "3",
    title: "No Woman, No Cry",
    mp3: Buffer.from("fake-data", "utf8")
  })

  return [musician, song1, song2]
}
