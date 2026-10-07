import {test} from 'node:test';
import assert from 'node:assert/strict';
import {configureMongoDns} from '../lib/mongo-dns';
import {getServers,setServers} from 'node:dns';
import {getServers as getPromiseServers,setServers as setPromiseServers} from 'node:dns/promises';
test('the default override configures both callback and promise DNS resolvers',()=>{
 const callback=getServers(),promise=getPromiseServers();
 try{configureMongoDns('1.1.1.1,8.8.8.8');assert.deepEqual(getServers(),['1.1.1.1','8.8.8.8']);assert.deepEqual(getPromiseServers(),['1.1.1.1','8.8.8.8']);}
 finally{setServers(callback);setPromiseServers(promise);}
});
test('DNS override is opt-in and preserves the system default when absent',()=>{
 let called=false;for(const value of [undefined,'',' '])configureMongoDns(value,()=>{called=true;});assert.equal(called,false);
});
test('DNS override accepts explicit resolver IPs without changing system settings',()=>{
 let actual:string[]=[];configureMongoDns('1.1.1.1, 8.8.8.8, 2606:4700:4700::1111',v=>{actual=v;});assert.deepEqual(actual,['1.1.1.1','8.8.8.8','2606:4700:4700::1111']);
});
test('invalid resolver input fails before applying any DNS change and never echoes input',()=>{
 for(const value of ['bad-host','1.1.1.1,','1.1.1.1,8.8.8.8,9.9.9.9,8.8.4.4','mongodb+srv://private:secret@example.test']){
  let called=false;assert.throws(()=>configureMongoDns(value,()=>{called=true;}),e=>e instanceof Error&&!e.message.includes(value));assert.equal(called,false);
 }
});
