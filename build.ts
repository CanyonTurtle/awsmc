import {encode, decode} from "./runtime/z85.ts";
import html from 'bun-plugin-html';

var codes: Map<string, string>;

async function do_build() {


  // here we manually copy over the index with the game's source copied in

  let cartdata = await Bun.file("./build/cart.wasm", {type: "application/wasm"}).arrayBuffer();
  // let codes = getCharCodesFromSource(cartdata);
  // let encoded_cart = encode(cartdata, codes);

  // const encoded = Buffer.from((<any>cartdata), 'binary').toString('base64')
  const encoded = encode(Buffer.from((<any>cartdata), 'binary'))

  let ht = await Bun.file("./runtime/app.html").text();
  let rewriter = new HTMLRewriter()

  // let codes_json = JSON.stringify(codes, (key, value) => (value instanceof Map ? [...value] : value));

  rewriter.on("div#cartdata", {
    element(el) {
      el.setAttribute("data-cart", encoded)
      el.setAttribute("data-cartlen", cartdata.byteLength.toString())
    }
  })
  await Bun.write("runtime/index.html", rewriter.transform(ht));

  
  // usual build semantics
  await Bun.build({
    entrypoints: ['./runtime/index.html'],
    outdir: './docs',
    minify: true,
    plugins: [
      html({
        inline: true
      })
    ]
  })
}

await do_build()