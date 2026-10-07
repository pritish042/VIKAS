import {isIP} from 'node:net';
import {setServers} from 'node:dns';
import {setServers as setPromiseServers} from 'node:dns/promises';

// Opt-in process DNS configuration for networks whose resolver breaks Atlas SRV lookups.
// Configure both APIs explicitly: MongoDB uses promise-based SRV/TXT queries.
// This does not change OS settings, TLS, the URI or discovered Atlas node addresses.
export function configureMongoDns(value:string|undefined,apply:(servers:string[])=>void=servers=>{setServers(servers);setPromiseServers(servers);}){
 if(!value?.trim())return;
 const servers=value.split(',').map(s=>s.trim());
 if(servers.length>3||servers.some(s=>!isIP(s)))throw new Error('MONGODB_DNS_SERVERS must contain one to three DNS server IP addresses.');
 apply(servers);
}
