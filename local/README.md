# Dynamo-Query Local Testing

1. Host a local DynamoDB by running `docker-compose up`
2. Make changes to `src/` and `local/app.ts`
3. Re-bundle the library and run test code:

```sh
cd local
yarn install
yarn start
```

### ⚠️ For non-Apple Silicon users

For windows or Intel Mac users, remove the `platform` from docker-compose

```diff
version: '3.8'
services:
  dynamo-local:
    image: amazon/dynamodb-local:latest
-   platform: linux/amd64
```
