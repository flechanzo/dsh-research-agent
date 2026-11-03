(function holdFile(){
 const fs=require('fs'),path=require('path'),{createRequire}=require('module');
 const target=path.resolve(process.argv[2]),asar=process.argv[3],workspace=path.resolve(process.argv[4]);
 if(path.basename(target)!=='research-state.json'||!target.startsWith(workspace+path.sep)||!fs.existsSync(target))throw Error('lock target outside isolated sidecar');
 const req=createRequire(asar+'/dsh/package.json'),koffi=createRequire(req.resolve('@deepseek-ai/dsh-fs-local'))('koffi'),kernel=koffi.load('kernel32.dll');
 const open=kernel.func('void* __stdcall CreateFileW(const char16_t*, uint32_t, uint32_t, void*, uint32_t, uint32_t, void*)');
 const close=kernel.func('int __stdcall CloseHandle(void*)');
 const handle=open(path.toNamespacedPath(target),0x80000000,3,null,3,0,null);
 if(handle===null||koffi.address(handle)===18446744073709551615n)throw Error('failed to acquire synthetic handle');
 const cleanup=()=>{close(handle);process.exit(0)};
 process.stdin.once('data',cleanup);process.stdin.once('end',cleanup);process.stdin.resume();console.log('READY');
})();
