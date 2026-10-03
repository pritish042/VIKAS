import {readFile} from 'node:fs/promises';
import {MongoClient} from 'mongodb';
import {prepareCatalogue,importCatalogue} from '../lib/catalogue-import';
import {prepareChapterCatalogue} from '../lib/chapter-catalogue';
import {chapterImportPlan,importChapterCatalogue} from '../lib/chapter-import';
import {configureMongoDns} from '../lib/mongo-dns';
// JSON is parsed as data, never evaluated. No network fetches of external resources.
async function main(){
 if(process.argv.includes('--file')){await chapters();return;}
 const source=JSON.parse(await readFile(new URL('../data/catalogue/research.json',import.meta.url),'utf8'));
 const routing=JSON.parse(await readFile(new URL('../data/catalogue/routing.json',import.meta.url),'utf8'));
 const batch=prepareCatalogue(source,routing);
 console.log(`Valid catalogue: ${batch.length} resources; ${batch.reduce((n,b)=>n+b.assessment.questions.length,0)} unvalidated topic-check questions. No manual review gate.`);
 if(!process.argv.includes('--write')){console.log('Dry run. Add --write to publish these catalogue entries and activate topic checks.');return;}
 if(!process.env.MONGODB_URI)throw new Error('Set MONGODB_URI.');
 const client=new MongoClient(process.env.MONGODB_URI,{serverSelectionTimeoutMS:5000});
 try{console.log(await importCatalogue(client.db(process.env.MONGODB_DB||'vikas'),batch));}finally{await client.close();}
}
async function chapters(){
 const args=process.argv.slice(2);for(let i=0;i<args.length;i++){if(['--file','--database'].includes(args[i])){if(!args[++i]||args[i].startsWith('--'))throw new Error('Missing argument.');}else if(!['--apply','--inspect-db','--publish-new'].includes(args[i]))throw new Error('Unknown option.');}
 if(args.includes('--publish-new')&&!args.includes('--apply'))throw new Error('--publish-new requires explicit --apply.');
 const path=args[args.indexOf('--file')+1];const batch=prepareChapterCatalogue(JSON.parse(await readFile(path,'utf8')));
 const database=process.env.MONGODB_DB||'vikas',apply=args.includes('--apply');
 console.log(JSON.stringify({database,...batch.report,mode:apply?'apply':'dry-run'},null,2));
 if(batch.report.rejected.length)throw new Error('Rejected records must be corrected before applying.');
 if(!apply&&!args.includes('--inspect-db'))return;
 if(apply&&(!args.includes('--database')||args[args.indexOf('--database')+1]!==database))throw new Error('Explicit --database must match the configured database.');
 if(!process.env.MONGODB_URI)throw new Error('Database is not configured.');
 configureMongoDns(process.env.MONGODB_DNS_SERVERS);
 const client=new MongoClient(process.env.MONGODB_URI,{serverSelectionTimeoutMS:5000});
 try{await client.connect();console.log(JSON.stringify(apply?await importChapterCatalogue(client.db(database),batch,{publishNew:args.includes('--publish-new')}):(await chapterImportPlan(client.db(database),batch)).report,null,2));}finally{await client.close();}
}
main().catch(()=>{console.error('Catalogue import failed. Check catalogue structure, routing and MongoDB settings. No credentials were logged.');process.exitCode=1;});
