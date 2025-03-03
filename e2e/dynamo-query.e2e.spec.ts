// TOOD
import { createClient } from '../src/services/cosmos-db.service';
import { DynamoDBClient, CreateTableCommand, ScalarAttributeType, KeyType } from '@aws-sdk/client-dynamodb';

const REGION = 'us-east-1';
const ENDPOINT = 'http://localhost:8000'; // For local DynamoDB testing
const TABLE_NAME = 'Users';
const CREDENTIALS = {
  accessKeyId: 'fakeMyKeyId',
  secretAccessKey: 'fakeSecretAccessKey',
};

type User = {
  id: string;
  firstName: string;
  lastName: string;
  age: number;
  createdAt: Date;
  isSuperAdmin: boolean;
};

// Initialize DynamoDB client for setup
const ddbClient = new DynamoDBClient({
  region: REGION,
  endpoint: ENDPOINT,
  credentials: CREDENTIALS,
});

let orm: Record<string, any>;

describe('DynamoDB E2E Tests', () => {
  beforeAll(async () => {
    // Create table before tests
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

    // Initialize ORM client
    orm = createClient({
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
  });

  it('Should initialize ORM client', () => {
    expect(orm).toBeDefined();
  });

  it('Should seed the table', async () => {
    const items = Array.from({ length: 10 }, (_, i) => ({
      id: `user-${i}`,
      firstName: `FirstName${i}`,
      lastName: `LastName${i}`,
      age: i * 10,
      isSuperAdmin: false,
    }));

    for (const item of items) {
      await orm.user.create({ data: item });
    }

    const result = await orm.user.findMany({ take: 10 });
    expect(result.items.length).toEqual(10);
  });

  it('Should return x items when requesting x items', async () => {
    const result = await orm.user.findMany({
      take: 10,
    });
    expect(result.items.length).toEqual(10);
  });

  it('Should return items that satisfy filters applied', async () => {
    const result = await orm.user.findMany({
      where: {
        firstName: {
          contains: 'Name',
        },
        lastName: {
          endsWith: 'Name1',
          mode: 'INSENSITIVE',
        },
      },
      select: {
        firstName: true,
        lastName: true,
      },
    });

    // Adjust expectation based on seeded data
    // @ts-expect-error - TODO
    expect(result.items.every(item => item.firstName.includes('Name') && item.lastName.toLowerCase().endsWith('name1'))).toBe(true);
  });
});
