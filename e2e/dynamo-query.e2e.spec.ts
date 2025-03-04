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

  describe('Create', () => {
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

    it('Should create a new item', async () => {
      // TODO: Implement test
      // 1. Use create with data: { firstName: 'Test', lastName: 'User', age: 25, isSuperAdmin: false }
      // 2. Retrieve the item by ID and check if it matches the created data
    });

    it('Should auto-generate ID when creating an item', async () => {
      // TODO: Implement test
      // 1. Use create without providing an ID
      // 2. Check if the returned item has an auto-generated ID
    });

    it('Should auto-generate timestamps when creating an item', async () => {
      // TODO: Implement test
      // 1. Use create and check if createdAt and updatedAt are set
    });

    it('Should handle creating an item with a duplicate ID', async () => {
      // TODO: Implement test
      // 1. Create a user with a specific ID
      // 2. Attempt to create another user with the same ID
      // 3. Check if the operation throws an error or handles it appropriately
    });
  });

  describe('Read', () => {
    it('Should return x items when requesting x items', async () => {
      const result = await orm.user.findMany({
        take: 10,
      });
      expect(result.items.length).toEqual(10);
    });

    it('Should return items that satisfy filters applied', async () => {
      const result: { items: User[] } = await orm.user.findMany({
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
      expect(result.items.every(item => item.firstName.includes('Name') && item.lastName.toLowerCase().endsWith('name1'))).toBe(true);
    });

    it('Should filter items using startsWith', async () => {
      // TODO: Implement test
      // 1. Seed data with various firstNames
      // 2. Use findMany with where: { firstName: { startsWith: 'Fi' } }
      // 3. Check if returned items have firstNames starting with 'Fi'
    });

    it('Should filter items using gte for numbers', async () => {
      // TODO: Implement test
      // 1. Seed data with various ages
      // 2. Use findMany with where: { age: { gte: 20 } }
      // 3. Check if returned items have age >= 20
    });

    it('Should filter items using lte for dates', async () => {
      // TODO: Implement test
      // 1. Seed data with various createdAt dates
      // 2. Use findMany with where: { createdAt: { lte: new Date('2024-01-01') } }
      // 3. Check if returned items have createdAt <= '2024-01-01'
    });

    it('Should filter items using not for boolean', async () => {
      // TODO: Implement test
      // 1. Seed data with various isSuperAdmin values
      // 2. Use findMany with where: { isSuperAdmin: { not: true } }
      // 3. Check if returned items have isSuperAdmin === false
    });

    it('Should handle multiple filters combined', async () => {
      // TODO: Implement test
      // 1. Seed data
      // 2. Use findMany with multiple where conditions
      // 3. Check if returned items satisfy all conditions
    });

    it('Should handle pagination with nextCursor', async () => {
      // TODO: Implement test
      // 1. Seed more than 10 items
      // 2. Use findMany with take: 5
      // 3. Use the nextCursor from the result to fetch the next page
      // 4. Check if the next page returns the correct items
    });

    it('Should return only selected fields', async () => {
      // TODO: Implement test
      // 1. Use findMany with select: { id: true, firstName: true }
      // 2. Check if returned items only have id and firstName fields
    });

    it('Should find one item by ID', async () => {
      // TODO: Implement test
      // 1. Create a user
      // 2. Use findOne with where: { id: user.id }
      // 3. Check if the returned item matches the created user
    });
  });

  describe('Update', () => {
    it('Should update a single field of an existing item', async () => {
      // TODO: Implement test
      // 1. Create a user
      // 2. Update one field (e.g., firstName)
      // 3. Retrieve the user and check if the field is updated
    });

    it('Should update multiple fields of an existing item', async () => {
      // TODO: Implement test
      // 1. Create a user
      // 2. Update multiple fields (e.g., firstName and age)
      // 3. Retrieve the user and check if the fields are updated
    });

    it('Should handle updating a non-existent item gracefully', async () => {
      // TODO: Implement test
      // 1. Attempt to update a user with a non-existent ID
      // 2. Check if the operation returns null or throws an appropriate error
    });
  });

  describe('Delete', () => {
    it('Should delete an existing item by its ID', async () => {
      // TODO: Implement test
      // 1. Create a user
      // 2. Delete the user by ID
      // 3. Attempt to retrieve the user and check if it’s no longer present
    });

    it('Should handle deleting a non-existent item gracefully', async () => {
      // TODO: Implement test
      // 1. Attempt to delete a user with a non-existent ID
      // 2. Check if the operation returns null or throws an appropriate error
    });
  });
});
