import { generateModels } from "../../main/codegen/generateModels"

it("should generate a simple model", () => {
  const result = generateModels(`
Partitions:
  Author: ["author", "_.authorId"]

Models:
  Author:
    partition: Author
    sort: ["author", "_.authorId"]
    id: string
    name: string
  `)

  expect(result).toEqual(`import { Key, Model } from "@ginger.io/beyonce"

export enum ModelType {
  Author = "Author"
}

export interface Author extends Model {
  model: ModelType.Author
  id: string
  name: string
}

export const PK = {
  Author: new Key<Author, { authorId: string }>(_ => ["author", _.authorId])
}

export const SK = {
  [ModelType.Author]: new Key<Author, { authorId: string }>(_ => [
    "author",
    _.authorId
  ])
}
`)
})

it("should generate two models model", () => {
  const result = generateModels(`
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

  expect(result).toEqual(`import { Key, Model } from "@ginger.io/beyonce"

export enum ModelType {
  Author = "Author",
  Book = "Book"
}

export interface Author extends Model {
  model: ModelType.Author
  id: string
  name: string
}

export interface Book extends Model {
  model: ModelType.Book
  id: string
  name: string
}

export const PK = {
  Author: new Key<Author | Book, { authorId: string }>(_ => [
    "author",
    _.authorId
  ])
}

export const SK = {
  [ModelType.Author]: new Key<Author, { authorId: string }>(_ => [
    "author",
    _.authorId
  ]),
  [ModelType.Book]: new Key<Book, { bookId: string }>(_ => ["book", _.bookId])
}
`)
})

