# awsmc

To install dependencies:

```bash
bun install
```

To run:

```bash
emcc console.c -o console.wasm -s EXPORTED_FUNCTIONS="['_configure', '_update']" -s EXPORTED_RUNTIME_METHODS='["ccall", "cwrap"]' -s STACK_SIZE=8mb --no-entry && bun index.ts
```

This project was created using `bun init` in bun v1.0.33. [Bun](https://bun.sh) is a fast all-in-one JavaScript runtime.
