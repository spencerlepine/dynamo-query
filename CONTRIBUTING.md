# Contributing

When it comes to open source, there are different ways you can contribute, all of which are valuable. Here's few guidelines that should help you as you prepare your contribution.

## Initial steps

Before you start working on a contribution, create an issue describing what you want to build. It's possible someone else is already working on something similar, or perhaps there
is a reason that feature isn't implemented. The maintainers will point you in the right direction.

## Development

The following steps will get you setup to contribute changes to this repo:

1. Fork this repo.

2. Clone your forked repo

3. Make sure you have the matching version of `yarn` installed by running `pnpm --version`. Currently, we're on `1.22.22`

4. Run `yarn` to install dependencies.

5. Start playing with the code! You can do some simple experimentation in your own project or start implementing a feature right away.

### Commands

**`yarn build`**

- deletes `dist` and re-compiles `src` to `dist`

**`yarn test:unit`**

- runs all unit tests

### Tests

We use Jest for testing. After implementing your contribution, write tests for it. Just create a new file under `src/` or add additional tests to the appropriate existing file.

Before submitting your PR, run `yarn test:unit` to make sure there are no (unintended) breaking changes.

### E2E Testing

Using [act](https://github.com/nektos/act) (and Docker), you can run integration tests locally.

```sh
$ open -a Docker
$ brew install act
$ act --container-architecture linux/amd64

[Test - E2E/test-e2e  ] ⭐ Run Set up job
[Test - E2E/test-e2e  ] 🚀  Start image=nektos/act-environments-ubuntu:18.04
[Test - E2E/test-e2e  ]   🐳  docker pull image=amazon/dynamodb-local platform=linux/amd64 username= forcePull=true
...
```

### Documentation

The documentation lives in the README.md. Be sure to document any API changes you implement.

## License

By contributing your code to the GitHub repository, you agree to license your contribution under the MIT license.
