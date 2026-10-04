import {readFile} from 'node:fs/promises';
import {MongoClient} from 'mongodb';
import {prepareBoardDirectory,importBoardDirectory} from '../lib/board-directory';
import {configureMongoDns} from '../lib/mongo-dns';
async function main(){
 const args=process.argv.slice(2);for(let i=0;i<args.length;i++){if(['--file','--database'].includes(args[i])){if(!args[++i]||args[i].startsWith('--'))throw new Error('Missing argument.');}else if(args[i]!=='--apply')throw new Error('Unknown option.');}
 if(!args.includes('--file'))throw new Error('Supply --file.');
 const batch=prepareBoardDirectory(JSON.parse(await readFile(args[args.indexOf('--file')+1],'utf8')));
 console.log({validSearchLinks:batch.length,mode:args.includes('--apply')?'apply':'dry-run'});
 if(!args.includes('--apply'))return;
 const database=process.env.MONGODB_DB||'vikas';if(!args.includes('--database')||args[args.indexOf('--database')+1]!==database)throw new Error('Explicit database must match configuration.');
 if(!process.env.MONGODB_URI)throw new Error('Database unavailable.');configureMongoDns(process.env.MONGODB_DNS_SERVERS);
 const client=new MongoClient(process.env.MONGODB_URI,{serverSelectionTimeoutMS:5000});
 try{await client.connect();console.log(await importBoardDirectory(client.db(database),batch));}finally{await client.close();}
}
main().catch((error:unknown)=>{console.error('Failure type:',error instanceof Error?error.name:'unknown');console.error('Board directory import failed. Check the input and database configuration. No credentials were logged.');process.exitCode=1;});
