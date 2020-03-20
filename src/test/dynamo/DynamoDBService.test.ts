import { DynamoDB } from "aws-sdk"
import * as LocalDynamo from "dynamodb-local"
import { DynamoDBService } from "../../main/dynamo/DynamoDBService"
import { key } from "../../main/dynamo/Key"
import { Model } from "../../main/dynamo/Model"
const dynamoDBPort = 9000

/** A simple data model to test with Musicians and their Songs */

enum ModelType {
  MUSICIAN = "musician",
  SONG = "song"
}

interface Musician extends Model {
  readonly model: ModelType.MUSICIAN
  readonly id: string
  readonly name: string
}

interface Song extends Model {
  readonly model: ModelType.SONG
  readonly musicianId: string
  readonly id: string
  readonly title: string
}

const PK = {
  Musician: key<{ musicianId: string }, Musician | Song>("pk", _ => [
    "musician",
    _.musicianId
  ])
}

const SK = {
  Musician: key<{ musicianId: string }, Musician | Song>("sk", _ => [
    "musician",
    _.musicianId
  ]),
  Song: key<{ songId: string }, Song>("sk", _ => ["song", _.songId])
}

describe("DynamoDBService", () => {
  beforeAll(async () => LocalDynamo.launch(dynamoDBPort))
  afterAll(async () => LocalDynamo.stop(dynamoDBPort))

  it("should put and retrieve an item using pk + sk", async () => {
    const db = await setup()
    const musician: Musician = {
      id: "1",
      name: "Bob Marley",
      model: ModelType.MUSICIAN
    }

    await putMusician(db, musician)

    const result = await db.get({
      partition: PK.Musician({ musicianId: "1" }),
      sort: SK.Musician({ musicianId: "1" })
    })

    expect(result).toEqual(musician)
  })

  it("should put and retrieve multiple items using just pk", async () => {
    const db = await setup()
    const [musician, song1, song2] = aMusicianWithTwoSongs()

    await Promise.all([
      putMusician(db, musician),
      putSong(db, song1),
      putSong(db, song2)
    ])

    const result = await db.query(PK.Musician({ musicianId: "1" })).exec()
    expect(result).toEqual([musician, song1, song2])
  })

  it("should filter items when querying", async () => {
    const db = await setup()
    const [musician, song1, song2] = aMusicianWithTwoSongs()

    await Promise.all([
      putMusician(db, musician),
      putSong(db, song1),
      putSong(db, song2)
    ])

    const result = await db
      .query(PK.Musician({ musicianId: "1" }))
      .attributeNotExists("title")
      .or("title", "=", "Buffalo Soldier")
      .exec()

    expect(result).toEqual([musician, song1])
  })

  it("should batchGet items", async () => {
    const db = await setup()
    const [musician, song1, song2] = aMusicianWithTwoSongs()

    await Promise.all([
      putMusician(db, musician),
      putSong(db, song1),
      putSong(db, song2)
    ])

    const results = await db.batchGet({
      keys: [
        {
          partition: PK.Musician({ musicianId: "1" }),
          sort: SK.Musician({ musicianId: "1" })
        },
        {
          partition: PK.Musician({ musicianId: "1" }),
          sort: SK.Song({ songId: "2" })
        },
        {
          partition: PK.Musician({ musicianId: "1" }),
          sort: SK.Song({ songId: "3" })
        }
      ]
    })

    results.sort((a, b) => {
      if (a.id === b.id) {
        return 0
      } else if (a.id > b.id) {
        return 1
      } else {
        return -1
      }
    })

    expect(results).toEqual([musician, song1, song2])
  })
})

async function setup(): Promise<DynamoDBService> {
  const client = new DynamoDB({
    endpoint: `http://localhost:${dynamoDBPort}`,
    region: "us-west-2" // silly, but still need to specify region for LocalDynamo
  })

  // DynamoDB Local runs as an external http server, so we need to clear
  // the table from previous test runs
  const tableName = "TestTable"
  const { TableNames: tables } = await client.listTables().promise()
  if (tables !== undefined && tables.indexOf(tableName) !== -1) {
    await client.deleteTable({ TableName: tableName }).promise()
  }

  await client
    .createTable({
      TableName: tableName,
      KeySchema: [
        { AttributeName: "pk", KeyType: "HASH" },
        { AttributeName: "sk", KeyType: "RANGE" }
      ],

      AttributeDefinitions: [
        { AttributeName: "pk", AttributeType: "S" },
        { AttributeName: "sk", AttributeType: "S" }
      ],
      BillingMode: "PAY_PER_REQUEST"
    })
    .promise()

  return new DynamoDBService(tableName, client)
}

function aMusicianWithTwoSongs(): [Musician, Song, Song] {
  const musician: Musician = {
    id: "1",
    name: "Bob Marley",
    model: ModelType.MUSICIAN
  }
  const song1: Song = {
    musicianId: "1",
    id: "2",
    title: "Buffalo Soldier",
    model: ModelType.SONG
  }

  const song2: Song = {
    musicianId: "1",
    id: "3",
    title: "No Woman, No Cry",
    model: ModelType.SONG
  }
  return [musician, song1, song2]
}

function putMusician(db: DynamoDBService, m: Musician): Promise<void> {
  return db.put(
    {
      partition: PK.Musician({ musicianId: m.id }),
      sort: SK.Musician({ musicianId: m.id })
    },
    m
  )
}

function putSong(db: DynamoDBService, s: Song): Promise<void> {
  return db.put(
    {
      partition: PK.Musician({ musicianId: s.musicianId }),
      sort: SK.Song({ songId: s.id })
    },
    s
  )
}
