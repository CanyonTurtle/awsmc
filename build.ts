import {getCharCodesFromSource, encode, decode} from "./src/huffman.ts";

var codes: Map<string, string>;

async function do_build() {

  // usual build semantics
  await Bun.build({
    entrypoints: ['./src/console.ts'],
    outdir: './docs',
  })

  // here we manually copy over the index with the game's source copied in

  let cartdata = await Bun.file("./build/cart.wasm", {type: "application/wasm"}).arrayBuffer();
  // let codes = getCharCodesFromSource(cartdata);
  // let encoded_cart = encode(cartdata, codes);

  const encoded = Buffer.from(cartdata, 'binary').toString('base64')

  let ht = await Bun.file("./src/index.html").text();
  let rewriter = new HTMLRewriter()

  // let codes_json = JSON.stringify(codes, (key, value) => (value instanceof Map ? [...value] : value));

  rewriter.on("div#cartdata", {
    element(el) {
      el.setAttribute("data-cart", encoded)
    }
  })
  Bun.write("docs/index.html", rewriter.transform(ht))
}

await do_build()