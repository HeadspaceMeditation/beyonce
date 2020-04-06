import { Beyonce } from "../main/dynamo/Beyonce"
import { Table } from "../main/experimental/Table"

const table = new Table({
  name: "VaultDB",
  partitionKeyName: "pk",
  sortKeyName: "sk",
})

enum ModelType {
  EncryptedItem = "EncryptedItem",
  EncryptedItemKey = "EncryptedItemKey",
  Tag = "Tag",
}

interface EncryptedItemFields {
  model: ModelType.EncryptedItem
  id: string
  creatorId: string
  encryptedData: Buffer
}

interface EncryptedItemKeyFields {
  model: ModelType.EncryptedItemKey
  id: string
  itemId: string
  creatorId: string
  recipientId: string
  encryptedData: Buffer
}

interface TagFields {
  model: ModelType.Tag
  id: string
  itemId: string
}

const EncryptedItem = table
  .model<EncryptedItemFields>()
  .partitionKey(ModelType.EncryptedItem, "id")
  .sortKey(ModelType.EncryptedItem, "id")

const EncryptedItemKey = table
  .model<EncryptedItemKeyFields>()
  .partitionKey(ModelType.EncryptedItem, "itemId")
  .sortKey(`${ModelType.EncryptedItemKey}-recipient`, "recipientId")

const Tag = table
  .model<TagFields>()
  .partitionKey(ModelType.Tag, "id")
  .sortKey(`${ModelType.Tag}-itemId`, "itemId")

table
  .gsi("byModelAndId")
  .models([Tag])
  .partitionKey("id")

const partitions = {
  Items: table.partition([EncryptedItem, EncryptedItemKey]),
  Tags: table.partition([Tag]),
}

// Put / Get examples

async function run() {
  const beyonce = new Beyonce(table, {} as any)

  await beyonce.put(
    EncryptedItem.create({
      id: "1",
      encryptedData: Buffer.from(""),
      model: ModelType.EncryptedItem,
      creatorId: "1",
    })
  )

  const getResult = await beyonce.get(EncryptedItem.key({ id: "1" }))

  const batchGetResults = await beyonce.batchGet({
    keys: [
      EncryptedItem.key({ id: "1" }),
      EncryptedItemKey.key({ itemId: "foo", recipientId: "" }),
    ],
  })

  beyonce.batchPutWithTransaction({
    items: [
      EncryptedItem.create({
        id: "1",
        encryptedData: Buffer.from(""),
        model: ModelType.EncryptedItem,
        creatorId: "1",
      }),

      EncryptedItemKey.create({
        id: "2",
        model: ModelType.EncryptedItemKey,
        itemId: "",
        creatorId: "",
        recipientId: "",
        encryptedData: Buffer.from(""),
      }),
    ],
  })

  const results = await beyonce
    .query(partitions.Items.key({ id: "" }))
    .attributeExists("recipientId")
    .exec()

  const resultxs = await beyonce
    .query(partitions.Tags.key({ id: "" }))
    .attributeExists("itemId")
    .exec()
}
