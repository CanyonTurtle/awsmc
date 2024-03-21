# awsmc

To install dependencies:

```bash
bun install
```

To run:

```bash
emcc console.c -o docs/console.wasm -s EXPORTED_FUNCTIONS="['_configure', '_update']" -s STACK_SIZE=8mb --no-entry
```

Then open the `index.html` in your browser.

This project was created using `bun init` in bun v1.0.33. [Bun](https://bun.sh) is a fast all-in-one JavaScript runtime.
