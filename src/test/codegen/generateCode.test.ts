import { generateCode } from "../../main/codegen/generateCode"

it("should generate a simple model", () => {
  const result = generateCode(`
Tables:
  Library:
    Partitions:
      Authors:
        Author:
          partitionKey: [Author, $id]
          sortKey: [Author, $id]
          id: string
          name: string
`)

  expect(result).toEqual(`import { Table } from "@ginger.io/beyonce"

export const LibraryTable = new Table({
  name: "Library",
  partitionKeyName: "pk",
  sortKeyName: "sk",
  encryptionBlacklist: ["id"]
})

export enum ModelType {
  Author = "Author"
}

export interface Author {
  model: ModelType.Author
  id: string
  name: string
}

export const AuthorModel = LibraryTable.model<Author>(ModelType.Author)
  .partitionKey("Author", "id")
  .sortKey("Author", "id")

export type Model = Author

export const AuthorsPartition = LibraryTable.partition([AuthorModel])
`)
})

it("should generate two models", () => {
  const result = generateCode(`
Tables:
  Library:
    Partitions:
      Authors:
        Author:
          partitionKey: [Author, $id]
          sortKey: [Author, $id]
          id: string
          name: string

        Book:
          partitionKey: [Author, $authorId]
          sortKey: [Book, $id]
          id: string
          authorId: string
          name: string
`)

  expect(result).toEqual(`import { Table } from "@ginger.io/beyonce"

export const LibraryTable = new Table({
  name: "Library",
  partitionKeyName: "pk",
  sortKeyName: "sk",
  encryptionBlacklist: ["id", "authorId"]
})

export enum ModelType {
  Author = "Author",
  Book = "Book"
}

export interface Author {
  model: ModelType.Author
  id: string
  name: string
}

export interface Book {
  model: ModelType.Book
  id: string
  authorId: string
  name: string
}

export const AuthorModel = LibraryTable.model<Author>(ModelType.Author)
  .partitionKey("Author", "id")
  .sortKey("Author", "id")

export const BookModel = LibraryTable.model<Book>(ModelType.Book)
  .partitionKey("Author", "authorId")
  .sortKey("Book", "id")

export type Model = Author | Book

export const AuthorsPartition = LibraryTable.partition([AuthorModel, BookModel])
`)
})

it("should generate multiple tables with simple models", () => {
  const result = generateCode(`
Tables:
  Library:
    Partitions:
      Authors:
        Author:
          partitionKey: [Author, $id]
          sortKey: [Author, $userId]
          id: string
          name: string
          userId: string
  Music:
    Partitions:
      Musicians:
        Musician:
          partitionKey: [Musician, $id]
          sortKey: [Musician, $musicianId]
          id: string
          name: string
          musicianId: string
`)

  expect(result).toEqual(`import { Table } from "@ginger.io/beyonce"

export const LibraryTable = new Table({
  name: "Library",
  partitionKeyName: "pk",
  sortKeyName: "sk",
  encryptionBlacklist: ["id", "userId"]
})

export const MusicTable = new Table({
  name: "Music",
  partitionKeyName: "pk",
  sortKeyName: "sk",
  encryptionBlacklist: ["id", "musicianId"]
})

export enum ModelType {
  Author = "Author",
  Musician = "Musician"
}

export interface Author {
  model: ModelType.Author
  id: string
  name: string
  userId: string
}

export interface Musician {
  model: ModelType.Musician
  id: string
  name: string
  musicianId: string
}

export const AuthorModel = LibraryTable.model<Author>(ModelType.Author)
  .partitionKey("Author", "id")
  .sortKey("Author", "userId")

export const MusicianModel = MusicTable.model<Musician>(ModelType.Musician)
  .partitionKey("Musician", "id")
  .sortKey("Musician", "musicianId")

export type Model = Author | Musician

export const AuthorsPartition = LibraryTable.partition([AuthorModel])
export const MusiciansPartition = MusicTable.partition([MusicianModel])
`)
})

it("should generate table, add partition and sork key to encryption blacklist", () => {
  const result = generateCode(`
Tables:
  Library:
    Partitions:
      Authors:
        Author:
          partitionKey: [Author, $id]
          sortKey: [Author, $id]
          id: string
          name: string

        Book:
          partitionKey: [Author, $id]
          sortKey: [Book, $id]
          id: string
          name: string

    GSIs:
      modelById:
        partitionKey: $model
        sortKey: $id
`)

  expect(result).toContain(`export const LibraryTable = new Table({
  name: "Library",
  partitionKeyName: "pk",
  sortKeyName: "sk",
  encryptionBlacklist: ["id", "model"]
})
`)
})

it("should generate GSI for Beyonces model field", () => {
  const result = generateCode(`
Tables:
  Library:
    Partitions:
      Authors:
        Author:
          partitionKey: [Author, $id]
          sortKey: [Author, $id]
          id: string
          name: string

        Book:
          partitionKey: [Author, $id]
          sortKey: [Book, $id]
          id: string
          name: string

    GSIs:
      modelById:
        partitionKey: $model
        sortKey: $id
`)

  expect(result).toContain(`const modelByIdGSI = LibraryTable.gsi("modelById")
  .models([AuthorModel, BookModel])
  .partitionKey("model")
  .sortKey("id")
`)
})

it("should generate GSI with specified fields", () => {
  const result = generateCode(`
Tables:
  Library:
    Partitions:
      Authors:
        Author:
          partitionKey: [Author, $id]
          sortKey: [Author, $id]
          id: string
          name: string

        Book:
          partitionKey: [Author, $id]
          sortKey: [Book, $id]
          id: string
          name: string

    GSIs:
      byNameAndId:
        partitionKey: $name
        sortKey: $id
`)

  expect(result)
    .toContain(`const byNameAndIdGSI = LibraryTable.gsi("byNameAndId")
  .models([AuthorModel, BookModel])
  .partitionKey("name")
`)
})

it("should generate GSI with pk and sk swapped", () => {
  const result = generateCode(`
Tables:
  Library:
    Partitions:
      Authors:
        Author:
          partitionKey: [Author, $id]
          sortKey: [Author, $id]
          id: string
          name: string

        Book:
          partitionKey: [Author, $id]
          sortKey: [Book, $id]
          id: string
          name: string

    GSIs:
      byNameAndId:
        partitionKey: $sk
        sortKey: $pk
`)

  expect(result)
    .toContain(`const byNameAndIdGSI = LibraryTable.gsi("byNameAndId")
  .models([AuthorModel, BookModel])
  .partitionKey("sk")
  .sortKey("pk")`)
})

it("should import external TypeScript types from a package", () => {
  const result = generateCode(`
Tables:
  Library:
    Partitions:
      Authors:
        Author:
          partitionKey: [Author, $id]
          sortKey: [Author, $id]
          id: string
          name: BestNameEvah from @cool.io/some/sweet/package
`)

  const lines = result.split("\n").map((_) => _.trim())
  expect(lines).toContainEqual(
    `import { BestNameEvah } from \"@cool.io/some/sweet/package\"`
  )

  expect(lines).toContainEqual(`name: BestNameEvah`)
})

it("should generate a complex key model", () => {
  const result = generateCode(`
Tables:
  ComplexLibrary:
    Partitions:
      ComplexAuthors:
        ComplexAuthor:
          partitionKey: [Author, $id]
          sortKey: [Author, $id, $name]
          id: string
          name: string
`)

  expect(result).toEqual(`import { Table } from "@ginger.io/beyonce"

export const ComplexLibraryTable = new Table({
  name: "ComplexLibrary",
  partitionKeyName: "pk",
  sortKeyName: "sk",
  encryptionBlacklist: ["id", "name"]
})

export enum ModelType {
  ComplexAuthor = "ComplexAuthor"
}

export interface ComplexAuthor {
  model: ModelType.ComplexAuthor
  id: string
  name: string
}

export const ComplexAuthorModel = ComplexLibraryTable.model<ComplexAuthor>(
  ModelType.ComplexAuthor
)
  .partitionKey("Author", "id")
  .sortKey("Author", "id", "name")

export type Model = ComplexAuthor

export const ComplexAuthorsPartition = ComplexLibraryTable.partition([
  ComplexAuthorModel
])
`)
})
