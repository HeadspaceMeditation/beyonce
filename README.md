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

Define your `tables`, `models` and `partitions` in YAML:

```YAML
tables:
  # We have a single DynamoDB Table named "Library".
  Library:

    # Let's add two models to our Library table: Author and Book.
    models:
      Author:
        id: string
        name: string

      Book:
        id: string
        authorId: string
        name: string

    # Now, imagine we want to be able to retrieve an Author + all their Books
    # in a single DynamoDB Query operation.

    # To do that, we need a specific Author and all their Books to live under the same partition key.
    # How about we use "Author-$id" as the partition key? Great, let's go with that.

    # Beyonce calls a group of models that share the same partition key a "patition".
    # Let's define one now, and name it "Authors"
    partitions:
      Authors:

        # All Beyonce partition keys are prefixed (to help you avoid collisions)
        # We said above we want our final partition key to be "Author-$id",
        # so we set: "Author" as our prefix here
        partitionKeyPrefix: Author

        # And, now we can put a given Author and all their Books into the same partition
        models:
          Author:
            partitionKey: [$id] # "Author-$id"
            sortKey: [Author, $id]

          Book:
            partitionKey: [$authorId] # "Author-$authorId"
            sortKey: [Book, $id]
```

#### A note on `partitionKey` and `sortKey` syntax

Beyonce expects you to specify your partition and sort keys using arrays, e.g. `[Author, $id]`. The first element in this example is interpreted as a string literal, while the second substitutes the value of a specific model instance's `id` field. In addition, Beyonce prefixes partition keys with the `partitionKeyPrefix` set on the Beyonce "partition" configured your the YAML file.

In our example above, we set the `Author` partiion's `partitionKeyPrefix` to `"Author"` and the `Author` model's `partitionKey` field to `[$id]`. Thus the full partition key at runtime is `Author-$id` (Beyonce uses `-` as a delimiter).

If you'd like to form a composite partition or sort key using multiple model fields, that is supported as well, e.g. `[$id, $name]`.

#### Global secondary indexes

If your table(s) have GSI's you can specify them like this:

```YAML
tables:
  Library:
    models:
     ...
    partitions:
      ...

    gsis:
      byName: # must match your GSI's name
        partitionKey: $name # name field must exist on at least one model
        sortKey: $id # same here
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

### 4. Create your DynamoDB table(s)

```TypeScript
import { LibraryTable } from "generated/models"
const dynamo = new DynamoDB({ endpoint: "...", region: "..."})
await dynamo
  .createTable(LibraryTable.asCreateTableInput("PAY_PER_REQUEST"))
  .promise()
```

### 5. Write type-safe queries

Now you can write partition-aware, type safe queries with abandon:

#### Get yourself a Beyonce

```TypeScript
import { Beyonce } from "@ginger.io/beyonce"
import { DynamoDB } from "aws-sdk"
import { LibraryTable } from "generated/models"

const beyonce = new Beyonce(LibraryTable, dynamo)
```

#### Then import the generated models

```TypeScript
import {
  AuthorModel,
  BookModel,
} from "generated/models"
```

## Queries

### Put

```TypeScript
const author = AuthorModel.create({
  id: "1",
  name: "Jane Austen"
})

await beyonce.put(author)
```

### Get

```TypeScript
const author = await beyonce.get(AuthorModel.key({ id: "1" }))
```

Note: the key `prefix` ("Author" from our earlier example) will be automatically appeneded.

### Update

Beyoncé supports type-safe partial updates on items, without having to read the item from the db first.
And it works, even through nested attributes:

```TypeScript
const updatedAuthor = await beyonce.update(AuthorModel.key({ id: "1" }), (author) => {
  author.name = "Jack London",
  author.details.description = "American novelist"
  delete author.details.someDeprecatedField
})
```

Here `author` is an intelligent proxy object (thus we avoid having to read the full item from the DB prior to updating it).
And `beyonce.update(...)` returns the full `Author`, with the updated fields.

### Query

Beyoncé supports type-safe `query` operations that either return a single model type or all model types that live under a given partition key.

#### Querying for a specific model type

You can `query` for a single type of model like so:

```TypeScript
import { BookModel } from "generated/models"

// Get all Books for an Author
const results = await beyonce
  .query(BookModel.partitionKey({ authorId: "1" }))
  .exec() // returns { Book: Book[] }
```

To reduce the amount of data retrieved by DynamoDB, Beyoncé automatically applies a `KeyConditionExpression` that uses the `sortKey` prefix provided in your model definitions. For example, if the YAML definition for the `Book` model contains `sortKey:[Book, $id]` -- then the generated `KeyConditionExpression` will contain a clause like `#partitionKey = :partitionKey AND begins_with(#sortKey, Book)`.

#### Query for all models in a partition

You can also query for all models that live in a partition, like so:

```TypeScript
import { AuthorPartition } from "generated/models"

// Get an Author + their books
const results = await beyonce
  .query(AuthorPartition.key({ id: "1" }))
  .exec() // returns { Author: Author[], Book: Book[] }
```

Note that, in this case the generated `KeyconditionExpression` will not include a clause for the sort key since DynamoDB does not support OR-ing key conditions.

#### Filtering Queries

You can filter results from a query like so:

```TypeScript
// Get an Author + filter on their books
const authorWithFilteredBooks = await beyonce
  .query(AuthorPartition.key({ id: "1" }))
  .attributeNotExists("title") // type-safe fields
  .or("title", "=", "Brave New World") // type safe fields + operators
  .exec()
```

#### Paginating Queries

When you call `.exec()` Beyoncé will automatically page through all the results and return them to you.

If you would like to step through pages manually (e.g to throttle reads) -- use the `.iterator()` method instead:

```TypeScript
const iterator = beyonce
  .query(AuthorPartition.key({ id: "1" }))
  .iterator({ pageSize: 1 })

// Step through each page 1 by 1
for await (const { items, errors } of iterator) {
   // ...
}
```

The `errors` field above contains any exceptions thrown while attempting to load the next iterator "page".
So it's up to you, the caller to decide if you want to continue walking the iterator, or give up and exit.

**Important**: When an error is encountered within the iterator, you might get a partial result
that contains one or more `items` and one or more `errors`. Thus, you should always check `errors.length`.

##### Cursors

Each time you call `.next()` on the iterator, you'll also get a `cursor` back, which you can use to create a new iterator
that picks up where you left off

```TypeScript
const iterator1 = beyonce
  .query(AuthorPartition.key({ id: "1" }))
  .iterator({ pageSize: 1 })

const firstPage = await iterator1.next()
const { items, cursor } = firstPage.value // do something with these

// Later...
const iterator2 = beyonce
  .query(AuthorPartition.key({ id: "1" }))
  .iterator({ cursor, pageSize: 1 })

const secondPage = await iterator2.next()
```

### QueryGSI

```TypeScript
import { byNameGSI } from "generated/models"
const prideAndPrejudice = await beyonce
  .queryGSI(byNameGSI.name, byNameGSI.key("Jane Austen"))
  .where("title", "=", "Pride and Prejudice")
  .exec()
```

### Scan

You can `scan` every record in your DynamoDB table using an API that closely mirrors the `query` API. For example:

```TypeScript
import { AuthorPartition } from "generated/models"

// Scan through everything in the table and load it into memory (not recommended for prod)
const results = await beyonce
  .scan()
  .exec() // returns { Author: Author[], Book: Book[] }
```

```TypeScript
const iterator = beyonce
  .scan()
  .iterator({ pageSize: 1 })

// Step through each page 1 by 1
for await (const { items } of iterator) {
  // ...
}
```

#### Parallel Scans

You can perform "parallel scans" by passing a `parallel` config operation to the `.scan` method,
like so:

```TypeScript
// Somewhere inside of Worker 1
const segment1 = beyonce
  .scan({ parallel: { segmentId: 0, totalSegments: 2 }})
  .iterator()

for await (const results of segment1) {
  // ...
}

// Somewhere inside of Worker 2
const segment2 = beyonce
  .scan({ parallel: { segmentId: 1, totalSegments: 2 }})
  .iterator()

for await (const results of segment2) {
  // ...
}
```

These options mirror the underlying [DynamoDB API](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/Scan.html#Scan.ParallelScan)

### BatchGet

You can retrieve records in bulk via `batchGet`. DynamoDB allows retrieving a maximum of 100 items per
`batchGet` query. So, if you ask for more than **100 keys** in a single Beyonce `batchGet` call, Beyonce will automatically split
DynamoDB calls into N concurrent requests and join the results for you.

```TypeScript
// Batch get several items
const { items, unprocessedKeys } = await beyonce.batchGet({
  keys: [
    // Get 2 authors
    AuthorModel.key({ id: "1" }),
    AuthorModel.key({ id: "2" }),

    // And a specific book from each
    Book.key({ authorId: "1", id: "1" })
    Book.key({ authorId: "2" id: "2" })
  ]
})


// And the return type is:
// { author: Author[], book: Book[] }
const { Author, Book } = items
```

If the `unprocessedKeys` array isn't empty, you can retry
via:

```TypeScript
await beyonce.batchGet({ keys: unprocessedKeys })
```

### BatchWrite

You can batch put/delete records using `batchWrite`. If any operations can't be processed,
you'll get a populated `unprocessedPuts` array and/or an `unprocessedDeletes` array back.

```TypeScript
// Batch put or delete several items at once
const author1 = AuthorModel.create({
  id: "1",
  name: "Jane Austen"
})

const author2 = AuthorModel.create({
  id: "2",
  name: "Charles Dickens"
})

const {
  unprocessedPuts,
  unprocessedDeletes
} = await beyonce.batchWrite({ putItems: [author1], deleteItems: [Author.key({ id: author2.id })] })
```

#### BatchWriteWithTransaction

If you'd like to batch pute/delete records in an atomic transaction, you can use `batchWriteWithTransaction`.
And all operations will either succeed, or fail.

```TypeScript
await beyonce.batchWriteWithTransaction({ putItems: [author1], deleteItems: [Author.key({ id: author2.id })] })
```

## Consistent Reads

Beyonce supports consistent reads via an optional parameter on `get`, `batchGet` and `query`, e.g. `get(..., { consistentRead: true })`.
And if you'd like to _always_ make consistent reads by default, you can set this as the default when you create a Beyonce instance:

```TypeScript
new Beyonce(table, dynamo, { consistentReads: true })
```

**Note**: When you enable consistentReads on a Beyonce instance, you can override it on a per-operation basis by setting the method level `consistentRead` option.

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
  LibraryTable,
  dynamo,
  { jayz }
)
```

### Important note on Querying with Jay-Z enabled

Because Jay-Z performs encryption at the application level, DynamoDB query operations
occur _before_ decryption. Put plainly, this means you _can't_ filter `.query` calls using any attribute that isn't a partition or sort key.

## Things beyonce should do, but doesn't (yet)

1. Support the full range of Dynamo filter expressions

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

## Misc

You can enable AWS XRay tracing like so:

```TypeScript
const beyonce = new Beyonce(
  LibraryTable,
  dynamo,
  { xRayTracingEnabled: true }
)
```
