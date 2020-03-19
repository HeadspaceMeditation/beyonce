# Beyonce

A type-safe DynamoDB query builder for TypeScript. Beyonce's primary feature is making DynamoDB queries which return heterogeneous models both easy to
work with and type-safe.

## Motivation

When using DynamoDB, you often want to "pre-compute" joins by sticking a set of heterogeneous models into the same table, under the same partition key.
This allows for retrieving related records using a single query instead of N.

Unfortunately, most existing DynamoDB libraries, like [DynamoDBMapper](https://github.com/awslabs/dynamodb-data-mapper-js)), don't support this
use case as they follow the SQL convention sticking each model into a separte table.

For example, we might want to fetch an `Author` + all their `Book`s in a single query. And we'd accomplish that by giving both models
the same partition key - e.g. `author-${id}`.

AWS's [guidelines](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/bp-general-nosql-design.html), take this to the extreme:

> ...you should maintain as few tables as possible in a DynamoDB application.
> ...most well-designed applications require only one table,

Keep in mind that the _primary_ reason they recommened this is to _avoid_ forcing the application-layer to perform in-memory joins. Due to Amazon's scale, they are
highly motivated to minimize the number of roundtrip db calls. You are probably not Amazon scale. And thus
probably don't need to shove _everything_ into a single table. But you might want to
keep a few sets of heterogenous models in the same table, under the same partition key.

## Usage

### 1. Install

First install beyonce - `npm install @ginger.io/beyonce`

### 2. Define your models

Define your `partitions` and `models` in YAML like so:

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

You can specify non-primative types you need to import like so:

```YAML
Author:
    ...
    address: author/Address

```

Which will eventually codegen into `import { Address } from "author/address"`

### 3. Codegen TypeScript classes for your models, partition keys and sort keys

`npx beyonce --in src/models.yaml --out src/generated/models.ts`

### 4. Write type-safe queries

Now you can write partition-aware, type safe queries with abandon:

#### Create a DynamoDBService and import the generated models, partition keys and sort keys

```TypeScript
import { DynamoDBService } from "@ginger.io/beyonce"
import { DynamoDB } from "aws-sdk"
import {
  Author,
  Book,
  ModelType,
  PK,
  SK,
} from "generated/models"

const tableName = "Library"
const db = new DynamoDBService(tableName, new DynamoDB({ ... }))
```

#### Put

```TypeScript
const authorModel: Author = { ... } // plain JS object, beyonce will auto-map the types for you
await db.put({
  partition: [PK.Author, { authorId: "1" }],
  sort: [SK.Author, { authorId: "1" }]
 }, authorModel)

```

#### Get

```TypeScript
const author = await db.get({
  partition: [PK.Author, { authorId: "1" }],
  sort: [SK.Author, { authorId: "1" }]
})
```

#### Query

```TypeScript

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

)
```

The return types of the above queries are automatically inferred as `Author | Book`. And when processing
results you can easily determine which type of model you're dealing with via the `model` attribute beyonce
codegens onto your models.

```TypeScript
authorWithBooks.forEach(authorOrBook => {
  if (authorOrBook.model === ModelType.Author) {
      // do something with an Author model
  } else if (authorOrBook.model == ModelType.Book) {
      // do something with a Book model
  }
}
```

#### BatchGet

```TypeScript

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
