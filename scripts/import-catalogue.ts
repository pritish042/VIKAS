import {readFile} from 'node:fs/promises';
import {MongoClient} from 'mongodb';
import {prepareCatalogue,importCatalogue} from '../lib/catalogue-import';
// JSON is parsed as data, never evaluated. No network fetches of external resources.
async function main(){
 const source=JSON.parse(await readFile(new URL('../data/catalogue/research.json',import.meta.url),'utf8'));
 const routing=JSON.parse(await readFile(new URL('../data/catalogue/routing.json',import.meta.url),'utf8'));
 const batch=prepareCatalogue(source,routing);
 console.log(`Valid catalogue: ${batch.length} resources; ${batch.reduce((n,b)=>n+b.assessment.questions.length,0)} unvalidated topic-check questions. No manual review gate.`);
 if(!process.argv.includes('--write')){console.log('Dry run. Add --write to publish these catalogue entries and activate topic checks.');return;}
 if(!process.env.MONGODB_URI)throw new Error('Set MONGODB_URI.');
 const client=new MongoClient(process.env.MONGODB_URI,{serverSelectionTimeoutMS:5000});
 try{console.log(await importCatalogue(client.db(process.env.MONGODB_DB||'vikas'),batch));}finally{await client.close();}
}
main().catch(()=>{console.error('Catalogue import failed. Check catalogue structure, routing and MongoDB settings. No credentials were logged.');process.exitCode=1;});
