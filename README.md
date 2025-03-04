<p align="center">
  <img src="docs/logo.png" />
</p>

<div align="center">
  <h1>Dynamo-Query</h1>
  <a href="#"><img src="https://img.shields.io/npm/v/dynamo-query.svg?style=flat" /></a>
  <a href="#"><img src="https://img.shields.io/badge/PRs-welcome-brightgreen.svg" /></a>
  <a href="./LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue" /></a>
  <br />
  <br />
</div>

> This is a type-safe ORM for AWS DynamoDB NoSQL, inspired by [Prisma.io](https://www.prisma.io/)

This package is for you if you're building data-driven applications and you're using AWS DynamoDB NoSQL as the main database.

If you're tired of writing raw SQL for querying AWS DynamoDB NoSQL database with complex filters, then this package is for you, too.

## 🧠 Why Dynamo-Query over `@aws-sdk/client-dynamodb`?

- ✅ Type-safe advanced filtering
- 💪 Build-in SQL query-builder
- 🚀 Dynamic, type-safe field-selection - maximizing performance
- 🍃 No more hard-coding SQL queries, just bring your models

## 🚶‍♂️ How to get started?

Install this package

```shell
npm install dynamo-query
yarn install dynamo-query
pnpm install dynamo-query
```

Instantiate the client

```typescript
import { createClient } from 'dynamo-query';

type User = {
  id: string;
  firstName: string;
  lastName: string;
  age: number;
  createdAt: Date;
  isSuperAdmin: boolean;
};

type Post = {
  id: string;
  title: string;
  content: string;
  createdBy: string; // foreign key - User.id
};

// Example 1 - Using connection string
const orm = createClient({
  region: 'us-east-1', // AWS region
  credentials: {
    accessKeyId: '<AWS_ACCESS_KEY_ID>',
    secretAccessKey: '<AWS_SECRET_ACCESS_KEY>',
  },
  models: t => ({
    user: t.createModel<User>({
      tableName: 'Users',
      partitionKey: 'userId',
      options: { fields: ['name', 'email', 'createdAt'] },
    }),
    post: t.createModel<Post>({
      tableName: 'Posts',
      partitionKey: 'postId',
      sortKey: 'createdAt',
      options: { fields: ['title', 'content', 'authorId'] },
    }),
  }),
});

// Example 2 - Using custom endpoint (useful for local development/testing)
const orm = createClient({
  region: 'us-east-1',
  endpoint: 'http://localhost:8000', // Custom endpoint for local DynamoDB
  credentials: {
    accessKeyId: 'fakeMyKeyId',
    secretAccessKey: 'fakeSecretAccessKey',
  },
  models: t => ({
    user: t.createModel<User>({
      tableName: 'Users',
      partitionKey: 'userId',
      options: { fields: ['name', 'email', 'createdAt'] },
    }),
    post: t.createModel<Post>({
      tableName: 'Posts',
      partitionKey: 'postId',
      sortKey: 'createdAt',
      options: { fields: ['title', 'content', 'authorId'] },
    }),
  }),
});

// Example 3 - With additional model options
const orm = createClient({
  region: 'us-east-1',
  credentials: {
    accessKeyId: '<AWS_ACCESS_KEY_ID>',
    secretAccessKey: '<AWS_SECRET_ACCESS_KEY>',
  },
  models: t => ({
    user: t.createModel<User>({
      tableName: '<USER_TABLE_NAME>',
      partitionKey: 'id',
      options: {
        fields: {
          id: true, // Auto-generate IDs
          timestamp: true, // Auto-generate createdAt/updatedAt
        },
      },
    }),
    post: t.createModel<Post>({
      tableName: '<POST_TABLE_NAME>',
      partitionKey: 'id',
      sortKey: 'createdAt',
      options: {
        fields: false, // Disable auto-generated fields
      },
    }),
  }),
});

// Notes:
// - The 'partitionKey' is required and must match an attribute in your table
// - The 'sortKey' is optional and enables range queries when specified
// - Tables must be created beforehand with matching partition/sort keys
```

Make queries with simple filters

```typescript
const getFilteredUsers = async () => {
  return await orm.user.findMany({
    where: { firstName: { contains: 'Sam' } },
  });
};

const getFilteredUsers = async () => {
  return await orm.user.findMany({
    where: { age: { gte: 18 } },
  });
};

const getFilteredUsers = async () => {
  return await orm.user.findMany({
    where: { createdAt: { gte: new Date('2024-01-01') } },
  });
};

const getFilteredposts = async () => {
  return await orm.post.findMany({
    where: { createdBy: { equals: '<SOME_USER_ID>' } },
  });
};
```

Make a query without any filters

```typescript
// This will return maximum of 100 items by default
const result = orm.user.findMany({});
```

Or, make a query by applying some complex filters, field-selections, and pagination logic:

```typescript
const getFilteredUsers = async () => {
  return await orm.user.findMany({
    where: {
      firstName: {
        startsWith: 'Sa',
        endsWith: 'lyn',
        mode: 'INSENSITIVE',
      },
      age: {
        lte: 20,
        gte: 10,
        not: 15,
      },
      isSuperAdmin: {
        not: true,
      },
      createdAt: {
        lte: new Date('2024-12-31'),
        gte: new Date('2024-12-01'),
        not: new Date('2024-12-15'),
      },
    },
    orderBy: {
      firstName: 'ASC',
    },
    take: 10,
    select: {
      id: true,
      firstName: true,
      age: true,
    },
    nextCursor: '<PAGINATION_TOKEN>',
  });
};
```

Find an item by ID

```typescript
// without field-selection
const result = orm.user.findOne({
  where: { id: 'USER_ID' },
});

// with field-selection
const result = orm.user.findOne<User>({
  where: { id: 'USER_ID' },
  select: { id: true, firstName: true },
});
```

Create an item

```typescript
type CreateUserInput = Partial<User>;

const result = orm.user.create<CreateUserInput>({
  data: {
    firstName: '<FIRST_NAME>',
    lastName: '<LAST_NAME>',
  },
});
```

Update an item

```typescript
type UpdateUserInput = Partial<User>;

const result = orm.user.update<UpdateUserInput>({
  where: { id: '<USER_ID>' },
  data: {
    firstName: '<UPDATED_FIRST_NAME>',
  },
});
```

Delete an item

```typescript
const result = orm.user.delete({
  where: { id: '<USER_ID>' },
});
```

## 📝 Roadmap

- Core Query builder
- Comprehensive unit/e2e test coverage
- Bulk create / update operations
- Observability - query logging
- Filtering on more complex data types such as enums, enum arrays, string arrays & number arrays

## Contributing

We welcome contributions from the community! If you're interested in contributing to this project, please read the [CONTRIBUTING.md](./CONTRIBUTING.md) file to get started.

## Disclaimer

This project is a fork of [Mingyang-Li/cosmox](https://github.com/Mingyang-Li/cosmox) (credit to [@Mingyang-Li](https://github.com/Mingyang-Li)), inspired by Prisma, and is not an
official AWS product. Provided "as is" without warranty.

## License

[MIT](./LICENSE)
