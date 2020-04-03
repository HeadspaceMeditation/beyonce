# Beyonce

A type-safe DynamoDB query builder for TypeScript.

Beyonce's features include:

- **Low boilerplate**. Define your tables, partitions, indexes and models in YAML and Beyonce codegens TypeScript definitions for you.

- **Store heterogeneous models in the same table**. Unlike most DynamoDB libraries, Beyonce doesn't force you into a 1 model per table paradigm. It supports storing related models in the same table partition, which allows you to "precompute joins" and retrieve those models with a single roundtrip query to the db.

- **Type-safe API**. Beyonce's API is type-safe. It's aware of which models live under your partition and sort keys (even for global secondary indexes).
  When you `get`, `batchGet` or `query`, the result types are automatically inferred. And when you apply filters on your
  `query` the attribute names are automatically type-checked.

- **Application-level encryption**. Beyonce _loves_ [Jay-Z](https://github.com/ginger-io/jay-z) and supports him out of the box. Combine them into
  the power couple they deserve to be, and every non-key, non-index attribute on your models will be automatically encrypted _before_ you send it to Dynamo. This grants an additional layer of security beyond just enabling AWS's DynamoDB server-side-enryption option (which you should do too).

## Usage

### 1. Install

First install beyonce - `npm install @ginger.io/beyonce`

### 2. Define your models

Define your `partitions` and `models` in YAML:

```YAML
Tables:
  Library:
    Partitions:
      Author: [author, _.authorId]

    Models:
      Author:
        partition: Author # this matches the "Author" partition we defined above
        sort: [author, _.authorId]
        id: string
        name: string

      Book:
        partition: Author # notice how Author and Book both live in the "Author" partition
        sort: [book, _.bookId]
        id: string
        title: string
```

#### Global secondary indexes

If your table(s) have GSI's you can specify them like this:

```YAML
Tables:
  Library:
    Partitions:
      Author: [author, _.authorId]

    GSIs:
      byName: # this must match your GSI's name
        partition: name # this field must exist on at least one of your models
        sort: id # this field must exist on at least one of your models
```

**Note**: Beyonce currently assumes that your GSI indexes project _all_ model attributes, which will
be reflected in the return types of your queries.

#### External types

You can specify external types you need to import like so:

```YAML
Author:
    ...
    address: Address from author/Address

```

Which transforms into `import { Address } from "author/address"`

### 3. Codegen TypeScript classes for your models, partition keys and sort keys

`npx beyonce --in src/models.yaml --out src/generated/models.ts`

### 4. Write type-safe queries

Now you can write partition-aware, type safe queries with abandon:

#### Get yourself a Beyonce and import the generated models, partition keys and sort keys

```TypeScript
import { Beyonce } from "@ginger.io/beyonce"
import { DynamoDB } from "aws-sdk"
import {
  Author,
  author,
  Book,
  ModelType,
  LibraryTable,
} from "generated/models"

const beyonce = new Beyonce(
  LibraryTable.name,
  new DynamoDB({
    endpoint: "...",
    region: "..."
  })
)
```

## Queries

### Put

```TypeScript
// Beyonce generates helper methods to create model objects for you
const authorModel = author({
  id: "1",
  name: "Jane Austen"
})

await beyonce.put(
  {
    partition: LibraryTable.pk.Author({ authorId: "1" }),
    sort: LibraryTable.sk.Author({ authorId: "1" })
  },
  authorModel
)
```

### Get

```TypeScript
const author = await beyonce.get({
  partition: LibraryTable.pk.Author({ authorId: "1" }),
  sort: LibraryTable.sk.Author({ authorId: "1" })
}))
```

### Query

```TypeScript
// Get an Author + their books ( inferred type: (Author | Book)[] )
const authorWithBooks = await beyonce
  .query(LibraryTable.pk.Author({ authorId: "1" }))
  .exec()

// Get an Author + filter on their books (inferred type: (Author | Book)[] )
const authorWithFilteredBooks = await beyonce
  .query(LibraryTable.pk.Author({ authorId: "1" }))
  .attributeNotExists("title") // type-safe fields
  .or("title", "=", "Brave New World") // type safe fields + operators
  .exec()
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

### QueryGSI

```TypeScript
const { byName } = LibraryTable.gsis
const prideAndPrejudice = await beyonce
  .queryGSI(byName.name, byName.pk({ name: "Jane Austen" }))
  .where("title", "=", "Pride and Prejudice")
  .exec()
```

### BatchGet

```TypeScript
// Batch get several items (inferred type: (Author | Book)[])
const batchResults = await beyonce.batchGet({
  keys: [
    // Get 2 authors
    {
      partition: LibraryTable.pk.Author({ authorId: "1" }),
      sort: LibraryTable.sk.Author({ authorId: "1" })
    },
    {
      partition: LibraryTable.pk.Author({ authorId: "2" }),
      sort: LibraryTable.sk.Author({ authorId: "2" })
    },

    // And a specific book from each
    {
      partition: LibraryTable.pk.Author({ authorId: "1" }),
      sort: LibraryTable.sk.Book({ bookId: "1" })
    },
    {
      partition: LibraryTable.pk.Author({ authorId: "2" }),
      sort: LibraryTable.sk.Book({ bookId: "2" })
    }
  ]
})
```

### BatchPutWithTransaction

```TypeScript
// Batch put several items in a transaction
const author1 = author({
  id: "1",
  name: "Jane Austen"
})

const author2 = author({
  id: "2",
  name: "Charles Dickens"
})

await beyonce.batchPutWithTransaction({
  keys: [
    {
      keys: {
        partition: LibraryTable.pk.Author({ authorId: author1.id }),
        sort: LibraryTable.sk.Author({ authorId: author1.id })
      },
      item: author1
    },
    {
      keys: {
        partition: LibraryTable.pk.Author({ authorId: author2.id }),
        sort: LibraryTable.sk.Author({ authorId: author2.id })
      },

      item: author2
    }
  ]
})
```

## Encryption

Beyonce integrates with [Jay-Z](https://github.com/ginger-io/jay-z) to enable transparent application-layer encryption
out of the box using KMS with just a few additional lines of code:

```TypeScript
import { KMS } from "aws-sdk"
import { KMSDataKeyProvider, JayZ } from "@ginger.io/jay-z"

// Given a dynamo client
const dynamo =  new DynamoDB({endpoint: "...", region: "..."})

// Get yourself a JayZ
const kmsKeyId = "..." // the KMS key id or arn you want to use
const keyProvider = new KMSDataKeyProvider(kmsKeyId, new KMS())
const jayZ = new JayZ({ keyProvider })

// And give him to Beyonce (because she runs this relationship)
const beyonce = new Beyonce(
  LibraryTable.name,
  dynamo,
  {
    jayz,
    encryptionBlacklist: Library.table.encryptionBlacklist // codegened set of fields to skip encrypting
  }
)
```

## Things beyonce should do, but doesn't (yet)

1. Support the full range of Dynamo filter expressions
2. Support partition and sort key names other than `pk` and `sk`

## An aside on storing heterogenous models in the same table

When using DynamoDB, you often want to "pre-compute" joins by sticking a set of heterogeneous models into the same table, under the same partition key.
This allows for retrieving related records using a single query instead of N.

Unfortunately most existing DynamoDB libraries, like [DynamoDBMapper](https://github.com/awslabs/dynamodb-data-mapper-js), don't support this
use case as they follow the SQL convention sticking each model into a separte table.

For example, we might want to fetch an `Author` + all their `Book`s in a single query. And we'd accomplish that by sticking both models
under the same partition key - e.g. `author-${id}`.

AWS's [guidelines](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/bp-general-nosql-design.html), take this to the extreme:

> ...most well-designed applications require only one table

Keep in mind that the _primary_ reason they recommened this is to _avoid_ forcing the application-layer to perform in-memory joins. Due to Amazon's scale, they are
highly motivated to minimize the number of roundtrip db calls.

You are probably not Amazon scale. And thus probably don't need to shove _everything_ into a single table.

But you might want to keep a few related models in the same table, under the same partition key and fetch
those models in a type-safe way. Beyonce makes that easy.
