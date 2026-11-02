import {build} from 'esbuild';
import {readFile,readdir,writeFile} from 'node:fs/promises';
const assets={};
for(const [folder,kind]of [['cmaps','cMapUrl'],['standard_fonts','standardFontDataUrl'],['wasm','wasmUrl']]) {
 for(const name of await readdir(`node_modules/pdfjs-dist/${folder}`)) {
  if(!/\.(bcmap|pfb|ttf|wasm)$/.test(name)||name.startsWith('quickjs'))continue;
  assets[`${kind}/${name}`]=(await readFile(`node_modules/pdfjs-dist/${folder}/${name}`)).toString('base64');
 }
}
await build({entryPoints:['src/pdf/app.js'],bundle:true,minify:true,format:'iife',target:'safari16',outfile:'site/pdf-viewer.js',plugins:[{name:'offline-pdf-resources',setup(b){b.onResolve({filter:/^lint-pdf-assets$/},()=>({path:'assets',namespace:'pdf'}));b.onLoad({filter:/.*/,namespace:'pdf'},()=>({contents:`export default ${JSON.stringify(assets)}`,loader:'js'}));}}]});
let licenses=await readFile('node_modules/pdfjs-dist/LICENSE','utf8');
for(const folder of ['cmaps','standard_fonts','wasm'])for(const name of await readdir(`node_modules/pdfjs-dist/${folder}`))if(name.startsWith('LICENSE'))licenses+=`\n\n--- ${folder}/${name} ---\n`+await readFile(`node_modules/pdfjs-dist/${folder}/${name}`,'utf8');
await writeFile('site/pdfjs-LICENSE.txt',licenses);
