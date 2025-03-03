'use strict';
var __awaiter =
  (this && this.__awaiter) ||
  function (thisArg, _arguments, P, generator) {
    function adopt(value) {
      return value instanceof P
        ? value
        : new P(function (resolve) {
            resolve(value);
          });
    }
    return new (P || (P = Promise))(function (resolve, reject) {
      function fulfilled(value) {
        try {
          step(generator.next(value));
        } catch (e) {
          reject(e);
        }
      }
      function rejected(value) {
        try {
          step(generator['throw'](value));
        } catch (e) {
          reject(e);
        }
      }
      function step(result) {
        result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected);
      }
      step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
  };
Object.defineProperty(exports, '__esModule', { value: true });
const dynamo_query_1 = require('dynamo-query');
const orm = (0, dynamo_query_1.createClient)({
  region: 'us-east-1',
  credentials: {
    accessKeyId: '<AWS_ACCESS_KEY_ID>',
    secretAccessKey: '<AWS_SECRET_ACCESS_KEY>',
  },
  models: t => ({
    user: t.createModel({
      tableName: 'Users',
      partitionKey: 'userId',
      options: { fields: true },
    }),
    post: t.createModel({
      tableName: 'Posts',
      partitionKey: 'postId',
      sortKey: 'createdAt',
      options: { fields: true },
    }),
  }),
});
const getFilteredUsers = () =>
  __awaiter(void 0, void 0, void 0, function* () {
    const result = yield orm.user.findMany({
      where: { firstName: { contains: 'Sam' } },
    });
    console.log(result);
    return result;
  });
getFilteredUsers();
