# Project conventions

## Keep the example in sync with the package

After every implementation change to `packages/time-core` (a new feature, a new
public API, a changed option, a behavior change), **update the example app**
`examples/react/time-core` in the same change so it exercises the new capability,
then verify it still builds:

```
cd examples/react/time-core && pnpm exec tsc --noEmit -p tsconfig.json && pnpm exec vite build
```

The example is the package's living dogfood — a feature isn't "done" until the
example registers/uses it and the build is green.
