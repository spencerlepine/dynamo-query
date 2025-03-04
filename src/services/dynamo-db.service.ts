// Examples: https://github.com/awsdocs/aws-doc-sdk-examples/blob/main/javascriptv3/example_code/dynamodb/README.md

import {
  DynamoDBClient,
  QueryCommand,
  GetItemCommand,
  PutItemCommand,
  UpdateItemCommand,
  DeleteItemCommand,
  ScanCommand,
  ScanCommandInput,
  AttributeValue,
} from '@aws-sdk/client-dynamodb';
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

  public async findMany(args: FindManyArgs<T>): Promise<FindManyResponse<T>> {
    const { where, take, nextCursor, orderBy } = args;
    // TODO - select?

    if (take && !z.number().int().min(1).safeParse(take).success) {
      throw new Error(`Please make sure "take" is a positive integer. You provided ${take}`);
    }

    const params: ScanCommandInput = {
      TableName: this.options.tableName,
      Limit: take ?? 100,
    };

    if (nextCursor) {
      params.ExclusiveStartKey = JSON.parse(nextCursor);
    }

    if (where && Object.keys(where).length > 0) {
      const filterExpression: string[] = [];
      const expressionAttributeNames: { [key: string]: string } = {};
      const expressionAttributeValues: { [key: string]: AttributeValue } = {};
      let placeholderCounter = 0;

      const prepareValue = (v: any): AttributeValue => {
        if (v instanceof Date) return { S: v.toISOString() };
        if (typeof v === 'string') return { S: v };
        if (typeof v === 'number') return { N: v.toString() };
        if (typeof v === 'boolean') return { BOOL: v };
        throw new Error(`Unsupported value type: ${typeof v}`);
      };

      const operatorSymbols: Record<string, string> = {
        equals: '=',
        not: '<>',
        gt: '>',
        gte: '>=',
        lt: '<',
        lte: '<=',
      };

      Object.entries(where as Record<string, { [key: string]: any }>).forEach(([field, condition]) => {
        if (!condition || typeof condition !== 'object' || Object.keys(condition).length === 0) {
          throw new Error(`Invalid condition for field "${field}". Expected a non-empty object.`);
        }

        const keys = Object.keys(condition);
        const operator = keys[0] as string;
        const value = condition[operator];

        if (value === undefined) {
          throw new Error(`Value for operator "${operator}" in field "${field}" is undefined.`);
        }

        const fieldPlaceholder = `#${field}`;
        const valuePlaceholder = `:val${placeholderCounter++}`;
        expressionAttributeNames[fieldPlaceholder] = field;
        expressionAttributeValues[valuePlaceholder] = prepareValue(value);

        if (operator in operatorSymbols) {
          filterExpression.push(`${fieldPlaceholder} ${operatorSymbols[operator]} ${valuePlaceholder}`);
        } else if (operator === 'contains') {
          filterExpression.push(`contains(${fieldPlaceholder}, ${valuePlaceholder})`);
        } else if (operator === 'startsWith') {
          filterExpression.push(`begins_with(${fieldPlaceholder}, ${valuePlaceholder})`);
        } else if (operator === 'endsWith') {
          // TODO - optimize? `endsWith` is not supported by DynamoDB SDK..
          filterExpression.push(`contains(${fieldPlaceholder}, ${valuePlaceholder})`);
        } else {
          throw new Error(`Unsupported operator: ${operator}`);
        }
      });

      if (filterExpression.length > 0) {
        params.FilterExpression = filterExpression.join(' AND ');
        params.ExpressionAttributeNames = expressionAttributeNames;
        params.ExpressionAttributeValues = expressionAttributeValues;
      }
    }

    const command = new ScanCommand(params);
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
    const { where } = args;
    // TODO - select

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
      // ExpressionAttributeNames: {}, // TODO - feature?
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
