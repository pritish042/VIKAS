import {isDeepStrictEqual} from 'node:util';
import {ObjectId,type Db,type Document} from 'mongodb';
// In-memory database double. No student fixtures are written to the configured database.
export function clone<T>(v:T):T {if(v instanceof ObjectId)return new ObjectId(v.toHexString()) as T;if(v instanceof Date)return new Date(v) as T;if(Array.isArray(v))return v.map(clone) as T;if(v&&typeof v==='object')return Object.fromEntries(Object.entries(v).map(([k,x])=>[k,clone(x)])) as T;return v;}
function get(row:Document,key:string):unknown{return key.split('.').reduce((v,k)=>v?.[k],row);}
function equal(a:unknown,b:unknown){return a instanceof ObjectId||b instanceof ObjectId?String(a)===String(b):isDeepStrictEqual(a,b);}
function matches(row:Document,query:Document):boolean{return Object.entries(query).every(([k,v])=>{if(k==='$and')return v.every((q:Document)=>matches(row,q));if(k==='$or')return v.some((q:Document)=>matches(row,q));if(k==='$text')return v.$search.split(' ').some((term:string)=>`${row.title} ${row.heading} ${row.text}`.toLowerCase().includes(term.toLowerCase()));const current=get(row,k);if(v&&typeof v==='object'&&!(v instanceof ObjectId)){if('$exists' in v)return (current!==undefined)===v.$exists;if('$in' in v)return v.$in.some((x:unknown)=>equal(current,x));}return Array.isArray(current)&&!Array.isArray(v)?current.some(x=>equal(x,v)):equal(current,v);});}
function set(row:Document,key:string,value:unknown){const parts=key.split('.');let target=row;for(const p of parts.slice(0,-1))target=target[p]??=( {} );target[parts.at(-1)!]=clone(value);}
function unset(row:Document,key:string){const parts=key.split('.');let target=row;for(const p of parts.slice(0,-1)){target=target[p];if(!target)return;}delete target[parts.at(-1)!];}
export class Memory {
 rows=new Map<string,Document[]>();failNextTaskWrite=false;failSearch=false;writes=0;
 collection(name:string){const rows=this.rows.get(name)||[];this.rows.set(name,rows);const memory=this;
  function cursor(query:Document){if(query.$text&&memory.failSearch)throw new Error('Search unavailable');let values=rows.filter(row=>matches(row,query));return {sort(order:Document){values.sort((a,b)=>{for(const [k,d] of Object.entries(order)){const x=get(a,k) as number,y=get(b,k) as number;if(x<y)return -Number(d);if(x>y)return Number(d);}return 0;});return this;},limit(n:number){values=values.slice(0,n);return this;},async toArray(){return clone(values);}};}
  return {async createIndex(){return '';},find:cursor,async findOne(query:Document,options?:Document){const c=cursor(query);if(options?.sort)c.sort(options.sort);return (await c.limit(1).toArray())[0]||null;},async countDocuments(query:Document){return rows.filter(r=>matches(r,query)).length;},async insertOne(row:Document){memory.writes++;const item={_id:new ObjectId(),...clone(row)};rows.push(item);return {insertedId:item._id};},async updateOne(query:Document,update:Document,options?:Document){
   memory.writes++;
   if(name==='tasks'&&memory.failNextTaskWrite){memory.failNextTaskWrite=false;throw new Error('Interrupted task write');}
   let row=rows.find(r=>matches(r,query));const exists=!!row;if(!row&&!options?.upsert)return {matchedCount:0,upsertedCount:0};if(!row){row={_id:new ObjectId()};for(const [k,v] of Object.entries(query))if(typeof v!=='object'||v instanceof ObjectId)set(row,k,v);rows.push(row);for(const [k,v] of Object.entries(update.$setOnInsert||{}))set(row,k,v);}
   for(const [k,v] of Object.entries(update.$inc||{}))set(row,k,Number(get(row,k)||0)+Number(v));
   for(const k of Object.keys(update.$unset||{}))unset(row,k);
   for(const [k,v] of Object.entries(update.$set||{}))set(row,k,v);for(const [k,v] of Object.entries(update.$addToSet||{})){const values=get(row,k) as unknown[]||[];for(const item of (v as Document).$each||[v])if(!values.some(existing=>equal(existing,item)))values.push(clone(item));set(row,k,values);}return {matchedCount:exists?1:0,upsertedCount:exists?0:1};
  },async findOneAndUpdate(query:Document,update:Document,options?:Document){await this.updateOne(query,update,options);return this.findOne(query);},async updateMany(query:Document,update:Document){for(const row of [...rows])if(matches(row,query))await this.updateOne({_id:row._id},update);return {acknowledged:true};},async deleteOne(query:Document){memory.writes++;const i=rows.findIndex(r=>matches(r,query));if(i<0)return {deletedCount:0};rows.splice(i,1);return {deletedCount:1};}};
 }
 asDb(){return this as unknown as Db;}
}
