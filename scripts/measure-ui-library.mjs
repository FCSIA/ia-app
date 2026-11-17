import { gzipSync, brotliCompressSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';
const root=fileURLToPath(new URL('..', import.meta.url)).replace(/\/$/, '');
const report={kind:'Isolated minified browser fixture; React external. Not route transfer bytes.',fixtures:{}};
for(const [name,file] of Object.entries({imagePreview:'components/ui/file-thumbnail.tsx',pdfPreview:'components/ui/pdf-file-thumbnail.tsx',defaultIcons:'lib/icon-context.tsx'})) {
 const result=await Bun.build({entrypoints:[`${root}/apps/web/src/${file}`],target:'browser',minify:true,external:['react','react-dom'],tsconfig:`${root}/apps/web/tsconfig.json`});
 if(!result.success) throw new Error(result.logs.join('\n'));
 let raw=0,gzip=0,brotli=0;for(const out of result.outputs){const data=Buffer.from(await out.arrayBuffer());raw+=data.length;gzip+=gzipSync(data).length;brotli+=brotliCompressSync(data).length;}
 report.fixtures[name]={raw,gzip,brotli};
}
console.log(JSON.stringify(report,null,2));
