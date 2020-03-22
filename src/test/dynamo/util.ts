import { JayZ } from "@ginger.io/jay-z"
import { DynamoDB } from "aws-sdk"
import * as LocalDynamo from "dynamodb-local"
import { Beyonce } from "../../main/dynamo/Beyonce"
import { key } from "../../main/dynamo/Key"
import { Model } from "../../main/dynamo/Model"
import { JayZConfig } from "../../main/dynamo/JayZConfig"

beforeAll(async () => LocalDynamo.launch(dynamoDBPort))
afterAll(async () => LocalDynamo.stop(dynamoDBPort))

export const dynamoDBPort = 9000

/** A simple data model to test with Musicians and their Songs */

export enum ModelType {
  MUSICIAN = "musician",
  SONG = "song"
}

export interface Musician extends Model {
  readonly model: ModelType.MUSICIAN
  readonly id: string
  readonly name: string
}

export interface Song extends Model {
  readonly model: ModelType.SONG
  readonly musicianId: string
  readonly id: string
  readonly title: string
}

export const PK = {
  Musician: key<{ musicianId: string }, Musician | Song>("pk", _ => [
    "musician",
    _.musicianId
  ])
}

export const SK = {
  Musician: key<{ musicianId: string }, Musician | Song>("sk", _ => [
    "musician",
    _.musicianId
  ]),
  Song: key<{ songId: string }, Song>("sk", _ => ["song", _.songId])
}

export const GSIs = {
  byModelAndId: {
    name: "byModelAndId",
    pk: key<{ model: string }, Musician | Song>("model", _ => [_.model]),
    sk: key<{ id: string }, Musician | Song>("id", _ => [_.id])
  },
  byNameAndId: {
    name: "byNameAndId",
    pk: key<{ name: string }, Musician>("name", _ => [_.name]),
    sk: key<{ id: string }, Musician>("id", _ => [_.id])
  }
}

export async function setup(jayz?: JayZ): Promise<Beyonce> {
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
        { AttributeName: "sk", AttributeType: "S" },
        { AttributeName: "model", AttributeType: "S" },
        { AttributeName: "name", AttributeType: "S" },
        { AttributeName: "id", AttributeType: "S" }
      ],

      GlobalSecondaryIndexes: [
        {
          IndexName: "byNameAndId",
          KeySchema: [
            { AttributeName: "name", KeyType: "HASH" },
            { AttributeName: "id", KeyType: "RANGE" }
          ],
          Projection: {
            ProjectionType: "ALL"
          }
        },
        {
          IndexName: "byModelAndId",
          KeySchema: [
            { AttributeName: "model", KeyType: "HASH" },
            { AttributeName: "id", KeyType: "RANGE" }
          ],
          Projection: {
            ProjectionType: "ALL"
          }
        }
      ],

      BillingMode: "PAY_PER_REQUEST"
    })
    .promise()

  const jayzConfig =
    jayz !== undefined
      ? {
          client: jayz,
          encryptionBlacklist: new Set(["pk", "sk", "model", "name", "id"])
        }
      : undefined

  return new Beyonce(tableName, client, {
    jayz: jayzConfig
  })
}

export function aMusicianWithTwoSongs(): [Musician, Song, Song] {
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

export function putMusician(db: Beyonce, m: Musician): Promise<void> {
  return db.put(
    {
      partition: PK.Musician({ musicianId: m.id }),
      sort: SK.Musician({ musicianId: m.id })
    },
    m
  )
}

export function putSong(db: Beyonce, s: Song): Promise<void> {
  return db.put(
    {
      partition: PK.Musician({ musicianId: s.musicianId }),
      sort: SK.Song({ songId: s.id })
    },
    s
  )
}
