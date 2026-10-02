import {MongoClient} from 'mongodb';
async function main(){
 for(const name of ['MONGODB_URI','BETTER_AUTH_URL','BETTER_AUTH_SECRET','GEMINI_API_KEY','GEMINI_MODEL','CONTENT_EDITOR_EMAILS'])console.log(`${name}: ${process.env[name]?'configured':'missing'}`);
 if(!process.env.MONGODB_URI)return;
 const client=new MongoClient(process.env.MONGODB_URI,{serverSelectionTimeoutMS:5000});
 try{const d=client.db(process.env.MONGODB_DB||'vikas');await d.command({ping:1});
  await d.collection('mentor_chunks').find({status:'approved',$text:{$search:'prerequisite',$language:'none'}},{projection:{_id:1},maxTimeMS:2000}).limit(1).toArray();
  console.log(JSON.stringify({mongoConnected:true,textSearchAvailable:true,approvedKnowledgeVersions:await d.collection('mentor_knowledge').countDocuments({status:'approved'}),reviewedPublishedResources:await d.collection('resources').countDocuments({status:'published',reviewedBy:{$exists:true},reviewedAt:{$exists:true}})}));
 }finally{await client.close();}
}
main().catch(()=>{console.error('Setup check failed. Check MongoDB access and run npm run db:indexes. No credentials were logged.');process.exitCode=1;});
