import {assertFreshBuild} from './build-provenance.mjs';
const m=assertFreshBuild();console.log('Verified current build',m.commit,m.sourceSha256);
