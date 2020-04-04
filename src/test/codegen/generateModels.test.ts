import { generateModels } from "../../main/codegen/generateModels"

const authorInterface = `export interface Author extends Model {
  model: ModelType.Author
  id: string
  name: string
}`

const bookInterface = `export interface Book extends Model {
  model: ModelType.Book
  id: string
  name: string
}`

const authorHelper = `export function author(fields: Omit<Author, "model">): Author {
  return {
    ...fields,
    model: ModelType.Author
  }
}`

const bookHelper = `export function book(fields: Omit<Book, "model">): Book {
  return {
    ...fields,
    model: ModelType.Book
  }
}`

const authorAndBookPk = `pk: {
    Author: key<{ authorId: string }, Author | Book>("pk", _ => [
      "author",
      _.authorId
    ])
  }`

const authorAndBookSk = `sk: {
    [ModelType.Author]: key<{ authorId: string }, Author>("sk", _ => [
      "author",
      _.authorId
    ]),
    [ModelType.Book]: key<{ bookId: string }, Book>("sk", _ => [
      "book",
      _.bookId
    ])
  }`

const authorAndBookUnion = `export type Model = Author | Book`

it("should generate a simple model", () => {
  const result = generateModels(`
Tables:
  Library:
    Partitions:
      Author: ["author", "_.authorId"]

    Models:
      Author:
        partition: Author
        sort: ["author", "_.authorId"]
        id: string
        name: string
`)

  expect(result).toEqual(`import { key, Model } from "@ginger.io/beyonce"

export enum ModelType {
  Author = "Author"
}

${authorInterface}

${authorHelper}

export type Model = Author

export const LibraryTable = {
  name: "Library",
  encryptionBlacklist: new Set(["pk", "sk", "model", "__jayz__metadata"]),

  pk: {
    Author: key<{ authorId: string }, Author>("pk", _ => ["author", _.authorId])
  },
  sk: {
    [ModelType.Author]: key<{ authorId: string }, Author>("sk", _ => [
      "author",
      _.authorId
    ])
  }
}
`)
})

it("should generate two models model", () => {
  const result = generateModels(`
Tables:
  Library:
    Partitions:
      Author: ["author", "_.authorId"]

    Models:
      Author:
        partition: Author
        sort: ["author", "_.authorId"]
        id: string
        name: string

      Book:
        partition: Author
        sort: ["book", "_.bookId"]
        id: string
        name: string
`)

  expect(result).toEqual(`import { key, Model } from "@ginger.io/beyonce"

export enum ModelType {
  Author = "Author",
  Book = "Book"
}

${authorInterface}

${bookInterface}

${authorHelper}

${bookHelper}

${authorAndBookUnion}

export const LibraryTable = {
  name: "Library",
  encryptionBlacklist: new Set(["pk", "sk", "model", "__jayz__metadata"]),

  ${authorAndBookPk},
  ${authorAndBookSk}
}
`)
})

it("should generate GSI for Beyonces model field", () => {
  const result = generateModels(`
Tables:
  Library:
    Partitions:
      Author: ["author", "_.authorId"]

    GSIs:
      modelById:
          partition: model
          sort: id

    Models:
      Author:
        partition: Author
        sort: ["author", "_.authorId"]
        id: string
        name: string

      Book:
        partition: Author
        sort: ["book", "_.bookId"]
        id: string
        name: string
`)

  expect(result).toEqual(`import { key, Model } from "@ginger.io/beyonce"

export enum ModelType {
  Author = "Author",
  Book = "Book"
}

${authorInterface}

${bookInterface}

${authorHelper}

${bookHelper}

${authorAndBookUnion}

export const LibraryTable = {
  name: "Library",
  encryptionBlacklist: new Set(["pk", "sk", "model", "__jayz__metadata", "id"]),

  ${authorAndBookPk},
  ${authorAndBookSk},
  gsis: {
    modelById: {
      name: "modelById",
      pk: key<{ model: string }, Author | Book>("model", _ => [_.model]),
      sk: key<{ id: string }, Author | Book>("id", _ => [_.id])
    }
  }
}
`)
})

it("should generate GSI with specified fields", () => {
  const result = generateModels(`
Tables:
  Library:
    Partitions:
      Author: ["author", "_.authorId"]

    GSIs:
      modelById:
          partition: name
          sort: id

    Models:
      Author:
        partition: Author
        sort: ["author", "_.authorId"]
        id: string
        name: string

      Book:
        partition: Author
        sort: ["book", "_.bookId"]
        id: string
        name: string
`)

  expect(result).toEqual(`import { key, Model } from "@ginger.io/beyonce"

export enum ModelType {
  Author = "Author",
  Book = "Book"
}

${authorInterface}

${bookInterface}

${authorHelper}

${bookHelper}

${authorAndBookUnion}

export const LibraryTable = {
  name: "Library",
  encryptionBlacklist: new Set([
    "pk",
    "sk",
    "model",
    "__jayz__metadata",
    "name",
    "id"
  ]),

  ${authorAndBookPk},
  ${authorAndBookSk},
  gsis: {
    modelById: {
      name: "modelById",
      pk: key<{ name: string }, Author | Book>("name", _ => [_.name]),
      sk: key<{ id: string }, Author | Book>("id", _ => [_.id])
    }
  }
}
`)
})

it("should generate GSI with pk and sk swapped", () => {
  const result = generateModels(`
Tables:
  Library:
    Partitions:
      Author: ["author", "_.authorId"]

    GSIs:
      skAsPk:
          partition: sk
          sort: pk

    Models:
      Author:
        partition: Author
        sort: ["author", "_.authorId"]
        id: string
        name: string

      Book:
        partition: Author
        sort: ["book", "_.bookId"]
        id: string
        name: string
`)

  expect(result).toContain(`
export const LibraryTable = {
  name: "Library",
  encryptionBlacklist: new Set(["pk", "sk", "model", "__jayz__metadata"]),

  ${authorAndBookPk},
  ${authorAndBookSk},
  gsis: {
    skAsPk: {
      name: "skAsPk",
      pk: key<{ sk: string }, Author | Book>("sk", _ => [_.sk]),
      sk: key<{ pk: string }, Author | Book>("pk", _ => [_.pk])
    }
  }
}
`)
})

it("should import external TypeScript types from a package", () => {
  const result = generateModels(`
Tables:
  Library:
    Partitions:
      Author: ["author", "_.authorId"]

    Models:
      Author:
        partition: Author
        sort: ["author", "_.authorId"]
        id: string
        name: BestNameEvah from @cool.io/some/sweet/package
`)

  const lines = result.split("\n").map((_) => _.trim())
  expect(lines).toContainEqual(
    `import { BestNameEvah } from \"@cool.io/some/sweet/package\"`
  )

  expect(lines).toContainEqual(`name: BestNameEvah`)
})
