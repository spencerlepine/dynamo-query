import { DynamoDBClient, QueryCommand, GetItemCommand, PutItemCommand, UpdateItemCommand, DeleteItemCommand, ScanCommand } from '@aws-sdk/client-dynamodb';
import { marshall, unmarshall } from '@aws-sdk/util-dynamodb';
import { z } from 'zod';
import { fromPromise } from 'neverthrow';
import { isArray, isBoolean, isEmptyArray, isNonEmptyString, isNull, isNumber, isObject, isUndefined, objectIsEmpty } from '../utils';
import { BooleanFilter, DateFilter, NumberFilter, QueryMode, StringFilter } from '../types/filters';

export type TFilter = StringFilter & NumberFilter & BooleanFilter & DateFilter;

export const IdSchema = z
  .string()
  .min(1)
  .refine(
    value => {
      const regex = /^\S+$/;
      return regex.test(value);
    },
    {
      message: `ID should not contain space characters, nor can it be an empty string.`,
    }
  );

export type Base = object;

interface AutoFields {
  id?: boolean;
  timestamp?: boolean;
}

export type ModelOptions = {
  tableName: string;
  client: DynamoDBClient;
  fields?: AutoFields | boolean;
  partitionKey: string; // Required for DynamoDB
  sortKey?: string; // Optional for DynamoDB
};

const defaultFields: AutoFields = {
  id: true,
  timestamp: true,
};

export type Where<T extends Base> = {
  [K in keyof T]?: T[K] extends string | undefined
    ? StringFilter
    : T[K] extends number | undefined
    ? NumberFilter
    : T[K] extends boolean | undefined
    ? BooleanFilter
    : T[K] extends Date | undefined
    ? DateFilter
    : never;
};

export type FindManyArgs<T extends Base> = {
  where?: Where<T>;
  take?: number;
  nextCursor?: string;
  select?: Partial<Record<keyof T, boolean>>;
  orderBy?: Partial<Record<keyof T, 'ASC' | 'DESC'>>;
};

export type FindManyResponse<T extends Base> = {
  items: T[];
  nextCursor?: string;
};

export type FindOneArgs<T extends Base> = {
  where: { id: string };
  select?: Partial<Record<keyof T, boolean>>;
};

export type CreateArgs<T extends Base> = {
  data: T;
};

export type UpdateArgs<T extends Base> = {
  where: { id: string };
  data: T;
};

export class BaseModel<T extends Base = any> {
  private fields: AutoFields = { ...defaultFields };
  private partitionKey: string;
  private sortKey?: string;

  constructor(private readonly options: ModelOptions) {
    this.partitionKey = options.partitionKey;
    this.sortKey = options.sortKey;
    if (options.fields !== undefined) {
      this.fields = typeof options.fields === 'boolean' ? { id: options.fields, timestamp: options.fields } : { ...defaultFields, ...options.fields };
    }
  }

  private buildExpressionAttributeNames(select?: Partial<Record<keyof T, boolean>>): Record<string, string> {
    if (!select || objectIsEmpty(select)) {
      return {};
    }
    return (
      Object.keys(select)
        // @ts-expect-error - TODO
        .filter(key => select[key])
        .reduce((acc, key) => ({ ...acc, [`#${key}`]: key }), {})
    );
  }

  private buildFilterExpression(where?: Where<T>): { expression: string; values: Record<string, any> } {
    if (!where || objectIsEmpty(where)) {
      return { expression: '', values: {} };
    }

    const expressions: string[] = [];
    const values: Record<string, any> = {};
    let paramCount = 0;

    for (const [field, filter] of Object.entries(where)) {
      const filterEntries = Object.entries(filter as object);
      for (const [key, value] of filterEntries) {
        const param = `:val${paramCount++}`;
        switch (key) {
          case 'equals':
            expressions.push(`#${field} = ${param}`);
            values[param] = value;
            break;
          case 'not':
            expressions.push(`#${field} <> ${param}`);
            values[param] = value;
            break;
          case 'gt':
            expressions.push(`#${field} > ${param}`);
            values[param] = value;
            break;
          case 'gte':
            expressions.push(`#${field} >= ${param}`);
            values[param] = value;
            break;
          case 'lt':
            expressions.push(`#${field} < ${param}`);
            values[param] = value;
            break;
          case 'lte':
            expressions.push(`#${field} <= ${param}`);
            values[param] = value;
            break;
          case 'contains':
            expressions.push(`contains(#${field}, ${param})`);
            values[param] = value;
            break;
          // Add more filter types as needed
        }
      }
    }

    return {
      expression: expressions.join(' AND '),
      values,
    };
  }

  public async findMany(args: FindManyArgs<T>): Promise<FindManyResponse<T>> {
    const { where, take, nextCursor, select, orderBy } = args;

    if (take && !z.number().int().min(1).safeParse(take).success) {
      throw new Error(`Please make sure "take" is a positive integer. You provided ${take}`);
    }

    const expressionAttributeNames = this.buildExpressionAttributeNames(select);
    const { expression: filterExpression, values } = this.buildFilterExpression(where);

    const parseWhereClause = (where = {}) => {
      const filterExpressions = [];
      const expressionAttributeNames = {};
      const expressionAttributeValues = {};

      for (const [key, condition] of Object.entries(where)) {
        // @ts-expect-error - TODO
        if (condition.contains) {
          const attrName = `#${key}`;
          const attrValue = `:${key}Val`;
          filterExpressions.push(`contains(${attrName}, ${attrValue})`);
          // @ts-expect-error - TODO
          expressionAttributeNames[attrName] = key;
          // @ts-expect-error - TODO
          expressionAttributeValues[attrValue] = { S: condition.contains };
        }
      }

      return {
        filterExpression: filterExpressions.length > 0 ? filterExpressions.join(' AND ') : undefined,
        expressionAttributeNames,
        expressionAttributeValues,
      };
    };

    const whereClause = parseWhereClause(where);

    const command = new ScanCommand({
      TableName: this.options.tableName,
      Limit: take ?? 100,
      ExclusiveStartKey: nextCursor ? JSON.parse(nextCursor) : undefined,
      ...(whereClause.filterExpression && {
        FilterExpression: whereClause.filterExpression,
      }),
      ...(Object.keys(expressionAttributeNames).length > 0 && {
        ExpressionAttributeNames: {
          ...whereClause.expressionAttributeNames,
          ...expressionAttributeNames,
        },
      }),
      ExpressionAttributeValues: {
        ...whereClause.expressionAttributeValues,
      },
      ProjectionExpression: Object.keys(expressionAttributeNames).length > 0 ? Object.keys(expressionAttributeNames).join(', ') : undefined,
    });

    const result = await fromPromise(this.options.client.send(command), e => e as Error);

    if (result.isErr()) {
      throw new Error(`Failed to retrieve items from db. ${result.error?.message}`);
    }

    const items = (result.value.Items?.map(item => unmarshall(item)) as T[]) || [];
    return {
      items,
      nextCursor: result.value.LastEvaluatedKey ? JSON.stringify(result.value.LastEvaluatedKey) : undefined,
    };
  }

  public async findOne(args: FindOneArgs<T>): Promise<T> {
    const { where, select } = args;

    const validateId = IdSchema.safeParse(where.id);
    if (!validateId.success) {
      throw new Error(validateId.error.message);
    }

    const command = new GetItemCommand({
      TableName: this.options.tableName,
      Key: marshall({
        [this.partitionKey]: where.id,
        ...(this.sortKey ? { [this.sortKey]: where.id } : {}),
      }),
      ProjectionExpression:
        select && Object.keys(select).length > 0
          ? Object.keys(select)
              // @ts-expect-error - TODO
              .filter(key => select[key])
              .map(key => `#${key}`)
              .join(', ')
          : undefined,
      ExpressionAttributeNames: this.buildExpressionAttributeNames(select),
    });

    const result = await fromPromise(this.options.client.send(command), e => e as Error);

    if (result.isErr()) {
      throw new Error(`Failed to retrieve item from db. ${result.error?.message}`);
    }

    if (!result.value.Item) {
      throw new Error(`We cannot find anything using the ID you provided`);
    }

    return unmarshall(result.value.Item) as T;
  }

  public async create(args: CreateArgs<T>): Promise<T> {
    const { data } = args;

    if (!isObject(data)) {
      throw new Error(`Please provide an object as payload. You provided "${data}"`);
    }

    if (objectIsEmpty(data)) {
      throw new Error(`Please provide an non-empty object as payload. You provided "{}"`);
    }

    const item = {
      [this.partitionKey]: (data as any).id || crypto.randomUUID(),
      ...(this.sortKey ? { [this.sortKey]: (data as any).id || crypto.randomUUID() } : {}),
      ...data,
      ...(this.fields.timestamp
        ? {
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          }
        : {}),
    };

    const command = new PutItemCommand({
      TableName: this.options.tableName,
      Item: marshall(item),
    });

    const result = await fromPromise(this.options.client.send(command), e => e as Error);

    if (result.isErr()) {
      throw new Error(`Failed to create item in db. ${result.error?.message}`);
    }

    return item as T;
  }

  public async update(args: UpdateArgs<T>): Promise<T> {
    const { where, data } = args;

    const validateId = IdSchema.safeParse(where.id);
    if (!validateId.success) {
      throw new Error(validateId.error.message);
    }

    if (!isObject(data)) {
      throw new Error(`Please provide an object as payload. You provided "${data}"`);
    }

    const updateExpression =
      'SET ' +
      Object.keys(data)
        .map((key, index) => `#${key} = :val${index}`)
        .join(', ') +
      (this.fields.timestamp ? ', #updatedAt = :updatedAt' : '');

    const expressionAttributeNames = {
      ...Object.keys(data).reduce((acc, key) => ({ ...acc, [`#${key}`]: key }), {}),
      ...(this.fields.timestamp ? { '#updatedAt': 'updatedAt' } : {}),
    };

    const expressionAttributeValues = {
      ...Object.entries(data).reduce(
        (acc, [key, value], index) => ({
          ...acc,
          [`:val${index}`]: value,
        }),
        {}
      ),
      ...(this.fields.timestamp ? { ':updatedAt': new Date().toISOString() } : {}),
    };

    const command = new UpdateItemCommand({
      TableName: this.options.tableName,
      Key: marshall({
        [this.partitionKey]: where.id,
        ...(this.sortKey ? { [this.sortKey]: where.id } : {}),
      }),
      UpdateExpression: updateExpression,
      ExpressionAttributeNames: expressionAttributeNames,
      ExpressionAttributeValues: marshall(expressionAttributeValues),
      ReturnValues: 'ALL_NEW',
    });

    const result = await fromPromise(this.options.client.send(command), e => e as Error);

    if (result.isErr()) {
      throw new Error(`Failed to update item. ${result.error?.message}`);
    }

    return unmarshall(result.value.Attributes!) as T;
  }

  public async delete(args: Pick<FindOneArgs<T>, 'where'>): Promise<void> {
    const { where } = args;

    const validateId = IdSchema.safeParse(where.id);
    if (!validateId.success) {
      throw new Error(validateId.error.message);
    }

    const command = new DeleteItemCommand({
      TableName: this.options.tableName,
      Key: marshall({
        [this.partitionKey]: where.id,
        ...(this.sortKey ? { [this.sortKey]: where.id } : {}),
      }),
    });

    const result = await fromPromise(this.options.client.send(command), e => e as Error);

    if (result.isErr()) {
      throw new Error(`Failed to delete item. ${result.error?.message}`);
    }
  }
}

interface Builder {
  createModel: <T extends Base>(args: { tableName: string; partitionKey: string; sortKey?: string; options?: Pick<ModelOptions, 'fields'> }) => BaseModel<T>;
}

export interface Options<M extends { [K: string]: BaseModel }> {
  region?: string;
  endpoint?: string;
  credentials?: {
    accessKeyId: string;
    secretAccessKey: string;
  };
  models: (builder: Builder) => M;
}

export type DB<M extends Record<string, BaseModel>> = ReturnType<Options<M>['models']>;

export const createClient = <M extends Record<string, BaseModel>>(options: Options<M>): DB<M> => {
  const client = new DynamoDBClient({
    region: options.region || 'us-east-1',
    endpoint: options.endpoint,
    credentials: options.credentials,
  });

  const builder: Builder = {
    createModel: args => {
      return new BaseModel({
        client,
        tableName: args.tableName,
        partitionKey: args.partitionKey,
        sortKey: args.sortKey,
        ...args.options,
      });
    },
  };

  return options.models(builder);
};
