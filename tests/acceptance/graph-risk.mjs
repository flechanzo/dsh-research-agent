import {isolatedContext} from './isolated-context.mjs';
import fs from 'node:fs';import path from 'node:path';import {researchDomain} from '../../packages/research-agent/lib/index.js';
const c=isolatedContext();
const synthetic=Object.values(JSON.parse(fs.readFileSync(path.join(c.home,'storages/research.json'),'utf8')).tables.sessions).find(r=>Object.values(r.state.artifacts).some(a=>a.content.includes('synthetic-paper.txt')));
if(!synthetic)throw new Error('isolated synthetic row unavailable');
const missing=structuredClone(synthetic);missing.state.selectedNodeId='nonexistent-node';
const cyclic=structuredClone(synthetic);const n=Object.values(cyclic.state.nodes)[0];n.parentNodeId=n.nodeId;
const result={scope:'Parser only; synthetic isolated row; no graph traversal or real data writes',missingSelectionAccepted:researchDomain.tables.sessions.valueSchema.safeParse(missing).success,selfCycleAccepted:researchDomain.tables.sessions.valueSchema.safeParse(cyclic).success,status:'FAIL F19 validation remains incomplete'};
fs.writeFileSync('docs/acceptance/graph-risk.json',JSON.stringify(result,null,2)+'\n');console.log(result);
