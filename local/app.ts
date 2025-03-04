import { createClient } from 'dynamo-query';
import { DynamoDBClient, CreateTableCommand, ScalarAttributeType, KeyType } from '@aws-sdk/client-dynamodb';

type User = {
  id: string;
  firstName: string;
  lastName: string;
  age: number;
  createdAt: Date;
  isSuperAdmin: boolean;
};

const REGION = 'us-east-1';
const ENDPOINT = 'http://localhost:8000';
const TABLE_NAME = 'Users';
const CREDENTIALS = {
  accessKeyId: 'fakeMyKeyId',
  secretAccessKey: 'fakeSecretAccessKey',
};

// Initialize DynamoDB client for setup
const ddbClient = new DynamoDBClient({
  region: REGION,
  endpoint: ENDPOINT,
  credentials: CREDENTIALS,
});

const orm = createClient({
  region: REGION,
  endpoint: ENDPOINT,
  credentials: CREDENTIALS,
  models: t => ({
    user: t.createModel<User>({
      tableName: TABLE_NAME,
      partitionKey: 'id',
      options: {
        fields: {
          id: true,
          timestamp: true,
        },
      },
    }),
  }),
});

const oneTimeSetup = async () => {
  const createTableParams = {
    TableName: TABLE_NAME,
    KeySchema: [{ AttributeName: 'id', KeyType: KeyType.HASH }],
    AttributeDefinitions: [{ AttributeName: 'id', AttributeType: ScalarAttributeType.S }],
    ProvisionedThroughput: {
      ReadCapacityUnits: 5,
      WriteCapacityUnits: 5,
    },
  };

  await ddbClient.send(new CreateTableCommand(createTableParams));

  // Wait for table to be created
  await new Promise(resolve => setTimeout(resolve, 1000));
};

const run = async () => {
  // Create
  const randomId = Math.floor(Math.random() * 1000);
  const newUser = {
    id: `user${randomId}`,
    firstName: `Bob`,
    lastName: `LastName${randomId}`,
    age: 29,
    isSuperAdmin: false,
  };
  // @ts-ignore - ORM client will add "createdAt"
  const sam = await orm.user.create({ data: newUser });
  console.log(sam);

  // Read
  const user = await orm.user.findOne({ where: { id: sam.id } });
  console.log(user);
  const allUsers = await orm.user.findMany({ take: 10 });
  console.log(allUsers);
  const sams = await orm.user.findMany({
    where: { firstName: { contains: 'Sam' } },
  });
  console.log(sams);
};

run();
