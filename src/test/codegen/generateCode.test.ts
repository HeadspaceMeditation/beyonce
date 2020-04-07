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
  sortKeyName: "sk"
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
  sortKeyName: "sk"
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
  .partitionKey("sk")`)
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
