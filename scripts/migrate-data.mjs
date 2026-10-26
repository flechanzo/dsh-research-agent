/** Copy an immutable research sidecar snapshot without touching Session logs. */
import fs from 'node:fs';import path from 'node:path';import crypto from 'node:crypto';import {fileURLToPath} from 'node:url';
import {researchDomain} from '../packages/research-agent/lib/index.js';
const sha=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
export function migrateResearch(sourceFile,destinationDirectory,{apply=false}={}){
 const source=path.resolve(sourceFile),target=path.join(path.resolve(destinationDirectory),'research.json');
 const bytes=fs.readFileSync(source);const input=JSON.parse(bytes.toString('utf8'));if(!input.unit||input.unit.name!=='research'||input.unit.version!==1||!input.tables?.sessions||typeof input.tables.sessions!=='object'||Array.isArray(input.tables.sessions))throw Error('Expected research domain v1 with a sessions table');
 for(const record of Object.values(input.tables.sessions))researchDomain.tables.sessions.valueSchema.parse(record);
 const hash=sha(bytes);if(sha(fs.readFileSync(source))!==hash)throw Error('Source changed while reading; retry after research activity stops');
 const existing=fs.existsSync(target)?sha(fs.readFileSync(target)):undefined;
 if(existing!==undefined&&existing!==hash)throw Error('Destination contains different research state; refusing to overwrite or merge');
 const result={source,target,records:Object.keys(input.tables.sessions).length,sha256:hash,status:existing===hash?'unchanged':apply?'copied':'dry-run'};
 if(apply&&existing===undefined){fs.mkdirSync(path.dirname(target),{recursive:true});const tmp=path.join(path.dirname(target),'.research-'+crypto.randomUUID()+'.tmp');const fd=fs.openSync(tmp,'wx',0o600);try{fs.writeFileSync(fd,bytes);fs.fsyncSync(fd);}finally{fs.closeSync(fd)}try{fs.linkSync(tmp,target)}finally{fs.unlinkSync(tmp)}if(sha(fs.readFileSync(target))!==hash)throw Error('Destination verification failed');}
 return result;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const args=process.argv.slice(2);const source=args[0],destination=args[1];if(!source||!destination)throw Error('Usage: node scripts/migrate-data.mjs <source-research.json> <destination-directory> [--apply]');console.log(JSON.stringify(migrateResearch(source,destination,{apply:args.includes('--apply')}),null,2));
}
