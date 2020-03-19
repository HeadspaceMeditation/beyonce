# Beyonce

A type-safe DynamoDB query builder for TypeScript. Designed with single-table architecture in mind.

## Motivation

AWS's [best practices](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/bp-general-nosql-design.html), encourage using a single DynamoDB table for each service:

> As a general rule, you should maintain as few tables as possible in a DynamoDB application.
> As emphasized earlier, most well-designed applications require only one table,
> unless there is a specific reason for using multiple tables.

Despite this guidance, most existing libraries, including AWS's own [DynamoDBMapper](https://github.com/awslabs/dynamodb-data-mapper-js) assume 1 DynamoDB table per model.

Furthermore, once you move to using a single table - querying becomes trickier as you wind up with sets of heterogeneous models that live under a single partition key. So you end up having to write a lot of mapping code to figure out which type of model you're dealing with in the result.

Beyonce makes this easy (and safe!) by automatically inferring the return types of your queries.

## Usage

First install beyonce - `npm install @ginger.io/beyonce`

First you define your `partitions` and `models` in YAML:

```YAML
Partitions:
  Author: [author, _.authorId]

Models:
  Author:
    partition: Author
    sort: [author, _.authorId]
    id: string
    name: string

  Book:
    partition: Author
    sort: [book, _.bookId]
    id: string
    title: string
```

Then you run the codegen:
`npx beyonce --in src/models.yaml --out src/generated/models.ts`

Then you can write type safe queries:

```TypeScript
import { DynamoDBService } from "@ginger.io/beyonce"
import { DynamoDB } from "aws-sdk"
import {
  Author,
  Book,
  PK,
  SK,
} from "generated/models"

// Setup your db client
const tableName = "Library"
const db = new DynamoDBService(tableName, new DynamoDB({ ... }))

// Insert an Author
const authorModel: Author = { ... } // plain JS object, beyonce will auto-map the types for you
await db.put({
  partition: [PK.Author, { authorId: "1" }],
  sort: [SK.Author, { authorId: "1" }]
 }, authorModel)

// Get an Author:
const author = await db.get({
  partition: [PK.Author, { authorId: "1" }],
  sort: [SK.Author, { authorId: "1" }]
})

// Get an Author + their books ( inferred type: (Author | Book)[] )
const authorWithBooks = await db
  .query(PK.Author, { authorId: "1" })
  .exec()

// Get an Author + filter on their books (inferred type: (Author | Book)[] )
const authorWithBooks = await db
  .query(PK.Author, { authorId: "1" })
  .attributeNotExists("title") // type-safe fields
  .or("title", "=", "Brave New World") // type safe fields + operators
  .exec()

// Batch get several items (type-inference is currently manual here)
const batchResults = await db.batchGet<Author | Book>({
    keys: [
        // Get 2 authors
        {
          partition: PK.Author.key({ authorId: "1" }),
          sort: SK.Author.key({ authorId: "1" })
        },
        {
          partition: PK.Author.key({ authorId: "2" }),
          sort: SK.Author.key({ authorId: "2" })
        },

        // And a specific book from each
        {
          partition: PK.Author.key({ authorId: "1" }),
          sort: SK.Book.key({ bookId: "1" })
        },
        {
          partition: PK.Author.key({ authorId: "2" }),
          sort: SK.Book.key({ bookId: "2" })
        }
      ]
    })
```

## Things beyonce should do, but doesn't (yet)

1. Support the full range of Dynamo filter expressions
2. Support for GSIs partitions
3. Automatic type inference on `batchGet`
