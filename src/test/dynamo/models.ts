import { Table } from "../../main/dynamo/Table"

export const table = new Table({
  name: "TestTable",
  partitionKeyName: "pk",
  sortKeyName: "sk",
})

export enum ModelType {
  Musician = "musician",
  Song = "song",
  Album = "album"
}

export interface Musician {
  model: ModelType.Musician
  id: string
  name: string
  details: {
    description?: string
  }
}

export interface Song {
  model: ModelType.Song
  musicianId: string
  id: string
  title: string
  mp3: Buffer
}

export interface Album {
  model: ModelType.Album
  id: string
  name: string
  musicianId: string,
  year: string,
}

export const MusicianModel = table
  .model<Musician>(ModelType.Musician)
  .partitionKey(ModelType.Musician, "id")
  .sortKey(ModelType.Musician, "id")

export const SongModel = table
  .model<Song>(ModelType.Song)
  .partitionKey(ModelType.Musician, "musicianId")
  .sortKey(ModelType.Song, "id")

export const AlbumModel = table
  .model<Album>(ModelType.Album)
  .partitionKey(ModelType.Musician, "musicianId")
  .sortKey(ModelType.Album, ["year", "id"])

export const MusicianPartition = table.partition([MusicianModel, SongModel, AlbumModel])

export const byModelAndIdGSI = table
  .gsi("byModelAndId")
  .models([MusicianModel, SongModel])
  .partitionKey("model")
  .sortKey("id")

export const byNameAndIdGSI = table
  .gsi("byNameAndId")
  .models([MusicianModel])
  .partitionKey("name")
  .sortKey("id")

export function aMusicianWithTwoSongs(): [Musician, Song, Song] {
  const musician = MusicianModel.create({
    id: "1",
    name: "Bob Marley",
    details: {
      description: "rasta man",
    },
  })

  const song1 = SongModel.create({
    musicianId: "1",
    id: "2",
    title: "Buffalo Soldier",
    mp3: Buffer.from("fake-data", "utf8"),
  })

  const song2 = SongModel.create({
    musicianId: "1",
    id: "3",
    title: "No Woman, No Cry",
    mp3: Buffer.from("fake-data", "utf8"),
  })

  return [musician, song1, song2]
}

export function aAlbum(album?: Partial<Album>): Album {
  const defaultAlbum = {
    id: "1",
    name: "Dummy",
    musicianId: "1",
    year: "1994"
  }
  return AlbumModel.create({ ...defaultAlbum, ...album })
}

export function someAlbums(): Album[] {
  return [
    aAlbum(),
    aAlbum({ id: "2", name: "Dummy Live" }),
    aAlbum({ id: "3", name: "Third", year: "2008" })]
}
