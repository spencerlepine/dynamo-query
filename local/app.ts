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
      options: { fields: true },
    }),
    post: t.createModel<Post>({
      tableName: 'Posts',
      partitionKey: 'postId',
      sortKey: 'createdAt',
      options: { fields: true },
    }),
  }),
});

const getFilteredUsers = async () => {
  const result = await orm.user.findMany({
    where: { firstName: { contains: 'Sam' } },
  });
  console.log(result);
  return result;
};

getFilteredUsers();
