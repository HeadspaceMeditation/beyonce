# Beyonce

A type-safe DynamoDB query builder for TypeScript.

Beyonce's primary feature is making DynamoDB queries which return heterogeneous models both easy to
work with and type-safe. But Beyonce also works with [Jay-Z](https://github.com/ginger-io/jay-z) out of the box to support application-layer encryption

## Motivation

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

## Usage

### 1. Install

First install beyonce - `npm install @ginger.io/beyonce`

### 2. Define your models

Define your `partitions` and `models` in YAML like so:

```YAML
Tables:
  Library:
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

And if you install [Jay-Z](https://github.com/ginger-io/jay-z), you can enable transparent application-layer encryption
out of the box using KMS with just a few more lines of code:

```TypeScript
import { KMS } from "aws-sdk"
import { KMSDataKeyProvider, JayZ } from "@ginger.io/jay-z"

const kmsKeyId = "..." // the KMS key id or arn you want to use
const keyProvider = new KMSDataKeyProvider(kmsKeyId, new KMS())
const jayZ = new JayZ(keyProvider)

const beyonce = new Beyonce(
  LibraryTable.name,
  new DynamoDB({
    endpoint: "...",
    region: "..."
  }),
  { jayz }
)
```

What a power couple!

## Queries

### Put

```TypeScript
// Beyonce generates helper methods to create model objects for you
const authorModel = author({
  id: "1",
  name: "Jane Austin"
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

## Things beyonce should do, but doesn't (yet)

1. Support the full range of Dynamo filter expressions
2. Support for GSIs partitions
