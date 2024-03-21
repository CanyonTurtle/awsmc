import html from 'bun-plugin-html';

await Bun.build({
  entrypoints: ['./index.html'],
  outdir: './dist',  // Specify the output directory
  plugins: [
    html()
  ],
});