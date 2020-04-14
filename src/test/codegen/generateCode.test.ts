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
  AnotherLibrary:
    Partitions:
      AnotherAuthors:
        AnotherAuthor:
          partitionKey: [AnotherAuthor, $anotherId]
          sortKey: [AnotherAuthor, $anotherUserId]
          id: string
          name: string
          anotherUserId: string
`)

  expect(result).toEqual(`import { Table } from "@ginger.io/beyonce"

export const LibraryTable = new Table({
  name: "Library",
  partitionKeyName: "pk",
  sortKeyName: "sk",
  encryptionBlacklist: ["id", "userId"]
})

export const AnotherLibraryTable = new Table({
  name: "AnotherLibrary",
  partitionKeyName: "pk",
  sortKeyName: "sk",
  encryptionBlacklist: ["anotherId", "anotherUserId"]
})

export enum ModelType {
  Author = "Author",
  AnotherAuthor = "AnotherAuthor"
}

export interface Author {
  model: ModelType.Author
  id: string
  name: string
  userId: string
}

export interface AnotherAuthor {
  model: ModelType.AnotherAuthor
  id: string
  name: string
  anotherUserId: string
}

export const AuthorModel = LibraryTable.model<Author>(ModelType.Author)
  .partitionKey("Author", "id")
  .sortKey("Author", "userId")

export const AnotherAuthorModel = AnotherLibraryTable.model<AnotherAuthor>(
  ModelType.AnotherAuthor
)
  .partitionKey("AnotherAuthor", "anotherId")
  .sortKey("AnotherAuthor", "anotherUserId")

export type Model = Author | AnotherAuthor

export const AuthorsPartition = LibraryTable.partition([AuthorModel])
export const AnotherAuthorsPartition = AnotherLibraryTable.partition([
  AnotherAuthorModel
])
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
