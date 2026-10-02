import {isIP} from 'node:net';
import {setServers} from 'node:dns';

// Opt-in process DNS configuration for networks whose resolver breaks Atlas SRV lookups.
// This does not change OS settings, TLS, the URI or discovered Atlas node addresses.
export function configureMongoDns(value:string|undefined,apply:(servers:string[])=>void=setServers){
 if(!value?.trim())return;
 const servers=value.split(',').map(s=>s.trim());
 if(servers.length>3||servers.some(s=>!isIP(s)))throw new Error('MONGODB_DNS_SERVERS must contain one to three DNS server IP addresses.');
 apply(servers);
}
