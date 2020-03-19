"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (Object.hasOwnProperty.call(mod, k)) result[k] = mod[k];
    result["default"] = mod;
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
const aws_sdk_1 = require("aws-sdk");
const LocalDynamo = __importStar(require("dynamodb-local"));
const Key_1 = require("main/dynamo/Key");
const DynamoDBService_1 = require("../../main/dynamo/DynamoDBService");
const dynamoDBPort = 9000;
/** A simple data model to test with Musicians and their Songs */
var ModelType;
(function (ModelType) {
    ModelType["MUSICIAN"] = "musician";
    ModelType["SONG"] = "song";
})(ModelType || (ModelType = {}));
const PK = {
    Musician: new Key_1.Key(_ => [
        "musician",
        _.musicianId
    ])
};
const SK = {
    Musician: new Key_1.Key(_ => [
        "musician",
        _.musicianId
    ]),
    Song: new Key_1.Key(_ => ["song", _.songId])
};
describe("DynamoDBService", () => {
    beforeAll(() => __awaiter(void 0, void 0, void 0, function* () {
        yield LocalDynamo.launch(dynamoDBPort);
    }));
    afterAll(() => __awaiter(void 0, void 0, void 0, function* () {
        yield LocalDynamo.stop(dynamoDBPort);
    }));
    it("should put and retrieve an item using pk + sk", () => __awaiter(void 0, void 0, void 0, function* () {
        const db = yield setup();
        const musician = {
            id: "1",
            name: "Bob Marley",
            model: ModelType.MUSICIAN
        };
        yield putMusician(db, musician);
        const result = yield db.get({
            partition: [PK.Musician, { musicianId: "1" }],
            sort: [SK.Musician, { musicianId: "1" }]
        });
        expect(result).toEqual(musician);
    }));
    it("should put and retrieve multiple items using just pk", () => __awaiter(void 0, void 0, void 0, function* () {
        const db = yield setup();
        const [musician, song1, song2] = aMusicianWithTwoSongs();
        yield Promise.all([
            putMusician(db, musician),
            putSong(db, song1),
            putSong(db, song2)
        ]);
        const result = yield db.query(PK.Musician, { musicianId: "1" }).exec();
        expect(result).toEqual([musician, song1, song2]);
    }));
    it("should filter items when querying", () => __awaiter(void 0, void 0, void 0, function* () {
        const db = yield setup();
        const [musician, song1, song2] = aMusicianWithTwoSongs();
        yield Promise.all([
            putMusician(db, musician),
            putSong(db, song1),
            putSong(db, song2)
        ]);
        const result = yield db
            .query(PK.Musician, { musicianId: "1" })
            .attributeNotExists("title")
            .or("title", "=", "Buffalo Soldier")
            .exec();
        expect(result).toEqual([musician, song1]);
    }));
    it("should batchGet items", () => __awaiter(void 0, void 0, void 0, function* () {
        const db = yield setup();
        const [musician, song1, song2] = aMusicianWithTwoSongs();
        yield Promise.all([
            putMusician(db, musician),
            putSong(db, song1),
            putSong(db, song2)
        ]);
        const results = yield db.batchGet({
            keys: [
                {
                    partition: PK.Musician.key({ musicianId: "1" }),
                    sort: SK.Musician.key({ musicianId: "1" })
                },
                {
                    partition: PK.Musician.key({ musicianId: "1" }),
                    sort: SK.Song.key({ songId: "2" })
                },
                {
                    partition: PK.Musician.key({ musicianId: "1" }),
                    sort: SK.Song.key({ songId: "3" })
                }
            ]
        });
        results.sort((a, b) => {
            if (a.id === b.id) {
                return 0;
            }
            else if (a.id > b.id) {
                return 1;
            }
            else {
                return -1;
            }
        });
        expect(results).toEqual([musician, song1, song2]);
    }));
});
function setup() {
    return __awaiter(this, void 0, void 0, function* () {
        const client = new aws_sdk_1.DynamoDB({
            endpoint: `http://localhost:${dynamoDBPort}`,
            region: "us-west-2" // silly, but still need to specify region for LocalDynamo
        });
        // DynamoDB Local runs as an external http server, so we need to clear
        // the table from previous test runs
        const tableName = "TestTable";
        const { TableNames: tables } = yield client.listTables().promise();
        if (tables !== undefined && tables.indexOf(tableName) !== -1) {
            yield client.deleteTable({ TableName: tableName }).promise();
        }
        yield client
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
            .promise();
        return new DynamoDBService_1.DynamoDBService(tableName, client);
    });
}
function aMusicianWithTwoSongs() {
    const musician = {
        id: "1",
        name: "Bob Marley",
        model: ModelType.MUSICIAN
    };
    const song1 = {
        musicianId: "1",
        id: "2",
        title: "Buffalo Soldier",
        model: ModelType.SONG
    };
    const song2 = {
        musicianId: "1",
        id: "3",
        title: "No Woman, No Cry",
        model: ModelType.SONG
    };
    return [musician, song1, song2];
}
function putMusician(db, m) {
    return db.put({
        partition: [PK.Musician, { musicianId: m.id }],
        sort: [PK.Musician, { musicianId: m.id }]
    }, m);
}
function putSong(db, s) {
    return db.put({
        partition: [PK.Musician, { musicianId: s.musicianId }],
        sort: [SK.Song, { songId: s.id }]
    }, s);
}
//# sourceMappingURL=DynamoDBService.test.js.map