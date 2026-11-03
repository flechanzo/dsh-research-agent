/** JSON array in, attributable pairwise analysis out. No inferred expert calibration. */
import fs from 'node:fs'
import {compareReviews} from '../packages/research-agent/src/innovation/reviews.ts'
const input=process.argv[2]
if(!input)throw Error('Usage: node --experimental-strip-types scripts/compare-rubric-reviews.mjs reviews.json [report.json]')
const result=JSON.stringify(compareReviews(JSON.parse(fs.readFileSync(input,'utf8'))),null,2)+'\n'
if(process.argv[3])fs.writeFileSync(process.argv[3],result,{flag:'wx'})
else process.stdout.write(result)
