import {build} from 'esbuild';
import {rm,mkdir,readFile,writeFile,copyFile,cp} from 'node:fs/promises';
await rm('dist',{recursive:true,force:true});
await mkdir('dist/server',{recursive:true});
await build({entryPoints:['public/app.js'],bundle:true,format:'iife',platform:'browser',target:'es2022',outfile:'dist/app.js',minify:true});
await writeFile('dist/app.txt',await readFile('dist/app.js'));
await build({entryPoints:['public/sources.js'],bundle:true,format:'iife',platform:'browser',target:'es2022',outfile:'dist/sources.js',minify:true});
await writeFile('dist/sources-app.txt',await readFile('dist/sources.js'));
await build({entryPoints:['src/worker.js'],bundle:true,format:'esm',platform:'browser',target:'es2022',outfile:'dist/server/index.js',loader:{'.html':'text','.css':'text','.txt':'text','.png':'binary','.svg':'text','.webmanifest':'text'},minify:true});
await Promise.all([
 cp('public/icons','dist/icons',{recursive:true}),
 copyFile('public/manifest.webmanifest','dist/manifest.webmanifest'),
 copyFile('public/infralobo-logo.png','dist/infralobo-logo.png'),
 copyFile('public/index.html','dist/index.html'),
 copyFile('public/sources.html','dist/sources.html'),
 copyFile('public/style.css','dist/style.css')
]);
console.log('PRISMA: interface, API de notícias e serviço RSS compilados.');
