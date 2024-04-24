import {encode} from "./runtime/base64.ts";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import html from 'bun-plugin-html';

async function bundle(cart: string, output: string) {
  // here we manually copy over the index with the game's source copied in

  let cartdata = await Bun.file(cart, {type: "application/wasm"}).arrayBuffer();
    
  // let codes = getCharCodesFromSource(cartdata);
  // let encoded_cart = encode(cartdata, codes);

  // const encoded = Buffer.from((<any>cartdata), 'binary').toString('base64')
  const encoded = encode(Buffer.from((<any>cartdata), 'binary'), undefined)

  let ht = await Bun.file("./runtime/app.html").text();
  let rewriter = new HTMLRewriter()


  // spritesheet
  let spritesheet_data = await Bun.file("./smiley.png", {type: "image/png"}).arrayBuffer();
  const encoded_spritesheet = encode(Buffer.from((<any>spritesheet_data), 'binary'), undefined)
  // let codes_json = JSON.stringify(codes, (key, value) => (value instanceof Map ? [...value] : value));

  rewriter.on("div#cartdata", {
    element(el) {
      el.setAttribute("data-cart", encoded)
      el.setAttribute("data-cartlen", cartdata.byteLength.toString())
      el.setAttribute("data-spritesheet", `data:image/png;base64,${encoded_spritesheet}`)
    }
  })
  await Bun.write("runtime/index.html", rewriter.transform(ht));


  // usual build semantics
  await Bun.build({
    entrypoints: ['./runtime/index.html'],
    outdir: output.split("/").slice(0, -1).join(""),
    minify: true,
    plugins: [
      html({
        inline: true
      })
    ]
  })

  console.log(`Bundled cartridge at ${cart} to ${output}.`)
}

async function do_build() {

  const argv = yargs(hideBin(Bun.argv))
  .command("bundle <cart> <output>", "Bundles a WASM game.", (yargs) => {
      yargs.positional("cart", {
        description: "Filepath to a .wasm file of your game.",
        type: "string",
      })
      yargs.positional("output", {
        description: "Filepath for the output bundled HTML game.",
        type: "string",
      })
    }, async ({cart, output}) => {
      await bundle((<string>cart), (<string>output));
    })
    .help()
    .demandCommand()
    .parse()

  
}

await do_build()