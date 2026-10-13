const path=require('node:path'),fs=require('node:fs'),{pathToFileURL}=require('node:url');
const root=path.resolve(__dirname,'../..');
(async()=>{const{createServer}=await import(pathToFileURL(require.resolve('vite',{paths:[root]})));const server=await createServer({root,server:{middlewareMode:true},appType:'custom'});try{
const{Sim}=await server.ssrLoadModule('/src/game/sim.ts');
const state=JSON.parse(fs.readFileSync(path.join(root,'docs/pixel-depth/fixtures/main-art.json')));
state.profile.cafeName='Canonical Staff QA';state.phase='open';state.dayTime=0;
const sim=new Sim(()=>0);sim.update(state,0);state.runtime=sim.snapshot(state);
fs.writeFileSync(path.join(root,'docs/pixel-depth/fixtures/server-canonical.json'),JSON.stringify(state,null,2)+'\n');
console.log(JSON.stringify({baristas:state.runtime.baristas.map(x=>x.look),servers:state.runtime.servers.map(x=>x.look),phase:state.phase}));
}finally{await server.close()}})().catch(e=>{console.error(e);process.exitCode=1});
