import { generateCode } from "../../main/codegen/generateCode"

it("should generate a simple model", () => {
  const result = generateCode(`
tables:
  Library:
    models:
      Author:
        id: string
        name: string
    partitions:
      Authors:
        partitionKeyPrefix: Author
        models:
          Author:
            partitionKey: [$id]
            sortKey: [Author, $id]
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
tables:
  Library:
    models:
      Author:
        id: string
        name: string

      Book:
        id: string
        authorId: string
        name: string

    partitions:
      Authors:
        partitionKeyPrefix: Author
        models:
          Author:
            partitionKey: [$id]
            sortKey: [Author, $id]

          Book:
            partitionKey: [$authorId]
            sortKey: [Book, $id]
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
tables:
  Library:
    models:
      Author:
        id: string
        name: string
        userId: string

    partitions:
      Authors:
        partitionKeyPrefix: Author
        models:
          Author:
            partitionKey: [$id]
            sortKey: [Author, $userId]

  Music:
    models:
      Musician:
        id: string
        name: string
        musicianId: string

    partitions:
      Musicians:
        partitionKeyPrefix: Musician
        models:
          Musician:
            partitionKey: [$id]
            sortKey: [Musician, $musicianId]
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

it("should generate table, add partition and sort key to encryption blacklist", () => {
  const result = generateCode(`
tables:
  Library:
    models:
      Author:
        id: string
        name: string

      Book:
        id: string
        name: string

    partitions:
      Authors:
        partitionKeyPrefix: Author
        models:
          Author:
            partitionKey: [$id]
            sortKey: [Author, $id]

          Book:
            partitionKey: [$id]
            sortKey: [Book, $id]

    gsis:
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
tables:
  Library:
    models:
      Author:
        id: string
        name: string

      Book:
        id: string
        name: string

    partitions:
      Authors:
        partitionKeyPrefix: Author
        models:
          Author:
            partitionKey: [$id]
            sortKey: [Author, $id]

          Book:
            partitionKey: [$id]
            sortKey: [Book, $id]

    gsis:
      modelById:
        partitionKey: $model
        sortKey: $id
`)

  expect(result).toContain(`export const modelByIdGSI = LibraryTable.gsi("modelById")
  .models([AuthorModel, BookModel])
  .partitionKey("model")
  .sortKey("id")
`)
})

it("should generate GSI with specified fields", () => {
  const result = generateCode(`
tables:
  Library:
    models:
      Author:
        id: string
        name: string

      Book:
        id: string
        name: string

    partitions:
      Authors:
        partitionKeyPrefix: Author
        models:
          Author:
            partitionKey: [$id]
            sortKey: [Author, $id]

          Book:
            partitionKey: [$id]
            sortKey: [Book, $id]

    gsis:
      byNameAndId:
        partitionKey: $name
        sortKey: $id
`)

  expect(result).toContain(`const byNameAndIdGSI = LibraryTable.gsi("byNameAndId")
  .models([AuthorModel, BookModel])
  .partitionKey("name")
`)
})

it("should generate GSI with pk and sk swapped", () => {
  const result = generateCode(`
tables:
  Library:
    models:
      Author:
        id: string
        name: string

      Book:
        id: string
        name: string

    partitions:
      Authors:
        partitionKeyPrefix: Author
        models:
          Author:
            partitionKey: [$id]
            sortKey: [Author, $id]

          Book:
            partitionKey: [$id]
            sortKey: [Book, $id]
    gsis:
      byNameAndId:
        partitionKey: $sk
        sortKey: $pk
`)

  expect(result).toContain(`const byNameAndIdGSI = LibraryTable.gsi("byNameAndId")
  .models([AuthorModel, BookModel])
  .partitionKey("sk")
  .sortKey("pk")`)
})

it("should import external TypeScript types from a package", () => {
  const result = generateCode(`
tables:
  Library:
    models:
      Author:
        id: string
        name: BestNameEvah from @cool.io/some/sweet/package

    partitions:
      Authors:
        partitionKeyPrefix: Author
        models:
          Author:
            partitionKey: [$id]
            sortKey: [Author, $id]
`)

  const lines = result.split("\n").map((_) => _.trim())
  expect(lines).toContainEqual(`import { BestNameEvah } from \"@cool.io/some/sweet/package\"`)

  expect(lines).toContainEqual(`name: BestNameEvah`)
})

it("should generate a complex key model", () => {
  const result = generateCode(`
tables:
  ComplexLibrary:
    models:
      ComplexAuthor:
        id: string
        name: string

    partitions:
      ComplexAuthors:
        partitionKeyPrefix: Author
        models:
          ComplexAuthor:
            partitionKey: [$id]
            sortKey: [Author, $id, $name]
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
