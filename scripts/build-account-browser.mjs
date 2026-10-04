import { build } from 'esbuild';
import { writeFile, mkdir } from 'node:fs/promises';
await mkdir('src/generated', { recursive: true });
const result = await build({entryPoints:['src/account-browser.ts'],bundle:true,write:false,format:'iife',platform:'browser',target:'es2022',minify:true});
await writeFile('src/generated/account-browser.txt',result.outputFiles[0].text);
