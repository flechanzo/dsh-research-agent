import fs from 'node:fs';import path from 'node:path';import {openAsar} from './asar-reader.mjs';
const a=openAsar('F:/deepseek/resources/app.asar');const root='D:/dsh-research-agent/.target-sdk';let count=0;
function walk(p){if(a.isDirectory(p)){for(const s of a.list(p))walk(p+'/'+s);return;}if(!/\.(?:json|js|mjs|cjs|ts|yml|yaml|css)$/.test(p))return;const out=path.join(root,p.slice(4));fs.mkdirSync(path.dirname(out),{recursive:true});fs.writeFileSync(out,a.bytes(p));count++;}
walk('dsh/node_modules');fs.mkdirSync(root,{recursive:true});fs.writeFileSync(root+'/package.json',a.read('dsh/package.json'));a.close();console.log({sdkFiles:count});
