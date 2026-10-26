import fs from 'node:fs';
export function openAsar(path) {
 const fd=fs.openSync(path,'r'), b=Buffer.alloc(16);fs.readSync(fd,b,0,16,0);const h=Buffer.alloc(b.readUInt32LE(12));fs.readSync(fd,h,0,h.length,16);const header=JSON.parse(h);const offset=8+b.readUInt32LE(4);
 const entry=p=>p.split('/').filter(Boolean).reduce((e,s)=>e?.files?.[s],header);
 function bytes(p){const e=entry(p);if(!e)throw Error(`Missing ASAR entry: ${p}`);if(e.unpacked)return fs.readFileSync(path+'.unpacked/'+p);const out=Buffer.alloc(e.size);fs.readSync(fd,out,0,e.size,offset+Number(e.offset));return out}
 return {list(p=''){return Object.keys(entry(p)?.files??{})},isDirectory(p){return !!entry(p)?.files},bytes,read(p){return bytes(p).toString('utf8')},close(){fs.closeSync(fd)}};
}
