# awsmc

[Live multi-touch demo!](https://canyonturtle.github.io/awsmc/)

AWSM is a highly-customizable virtual console, targetting web-capable platforms.

## About

Heavily inspired by WASM-4, this is a language-agnostic game engine with a GPU-accelerated framebuffer, that can run on any web-compatible platform (web, mobile, desktop). Unlike Wasm-4, this console opts for customizability rather than a coherent and stable experience. This includes a full any-sized RGBA framebuffer, and multitouch support, all accessible and customizable from code.

The main inspiration for making this is that I want to make my game <https://wasm4.org/play/kittygame/> be similar to Downwell (<https://downwellgame.com/>), which deviates from WASM-4's built-in gamepad, 160 by 160 display, etc...

But I also want this virtual console to work for anyone who:
- wants to make pixellated-ish GBA-like games with a simplistic API.
- Which can port to mobile, web, desktop (and maybe someday console?? :o)
- Who want to be able to do it all in their language of choice that compiles to Wasm.

## Create your own game

Compile a wasm file to `docs/cart.wasm` and visit `index.html` (Any http server can be used to serve up the `/docs` folder). There is no build tooling provided, bring your own everything lol. Still working on ideas for how this will work.

To build the demo `cart.wasm` from the demo game `src/game.c`, first install emscripten, then run

```bash
emcc src/game.c -o build/cart.wasm -s EXPORTED_FUNCTIONS="['_configure', '_update']" -s STACK_SIZE=8mb --no-entry
```

Now that the game is built, run as follows:
```bash
bun run build.ts
```

Now view index.html

If you want to host your game, just publish the docs folder to your site and you've got a game!

## Why is Bun in here?

Eventually I am considering building out some tooling to bundle games, etc... but I haven't made up my mind.


[Acknowledgments here.](./acknowledgments.md)