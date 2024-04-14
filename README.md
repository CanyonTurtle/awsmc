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
First, install [Bun](https://bun.sh/).
Next, install your programming language of choice that compiles to WASM.
For instance, you can build the demo game at `src/game.c` by installing [Emscripten](https://emscripten.org/).
Then:

```bash

# Grab this game engine onto your computer
git clone https://github.com/CanyonTurtle/awsmc.git

# Enter the folder
cd awsmc

# Install web dependencies for bundling
bun install

# Compile the game to a WASM file
emcc src/game.c -o build/cart.wasm -s EXPORTED_FUNCTIONS="['_configure', '_update']" -s STACK_SIZE=8mb --no-entry

# Bundle the WASM file into a playable HTML file.
bun run awsmc.ts bundle build/cart.wasm build/index.html
```

Now open `build/index.html`. You don't even have to "serve" the site - just opening in a browser will do. If all goes well, you should see a playable game!

## Publish your game

Just publish your HTML file to your site and you've got a game!

[Acknowledgments here.](./acknowledgments.md)