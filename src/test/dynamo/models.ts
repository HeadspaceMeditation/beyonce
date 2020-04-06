import { Table } from "../../main/experimental/Table"

export const table = new Table({
  name: "TestTable",
  partitionKeyName: "pk",
  sortKeyName: "sk",
})

export enum ModelType {
  Musician = "musician",
  Song = "song",
}

export interface Musician {
  model: ModelType.Musician
  id: string
  name: string
}

export interface Song {
  model: ModelType.Song
  musicianId: string
  id: string
  title: string
}

export const MusicianModel = table
  .model<Musician>()
  .partitionKey(ModelType.Musician, "id")
  .sortKey(ModelType.Musician, "id")

export const SongModel = table
  .model<Song>()
  .partitionKey(ModelType.Musician, "musicianId")
  .sortKey(ModelType.Song, "id")

export const MusicianPartition = table.partition([MusicianModel, SongModel])

export const byModelAndIdGSI = table
  .gsi("byModelAndId")
  .models([MusicianModel, SongModel])
  .partitionKey("model")

export const byNameAndIdGSI = table
  .gsi("byNameAndId")
  .models([MusicianModel])
  .partitionKey("name")

export function aMusicianWithTwoSongs(): [Musician, Song, Song] {
  const musician = MusicianModel.create({
    id: "1",
    name: "Bob Marley",
    model: ModelType.Musician,
  })

  const song1 = SongModel.create({
    musicianId: "1",
    id: "2",
    title: "Buffalo Soldier",
    model: ModelType.Song,
  })

  const song2 = SongModel.create({
    musicianId: "1",
    id: "3",
    title: "No Woman, No Cry",
    model: ModelType.Song,
  })

  return [musician, song1, song2]
}
