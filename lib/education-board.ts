// Exact aliases only: a custom board name containing "ISC" must not become ISC.
export function normalizeBoard(value:string):string {
 const board=value.toLowerCase().trim().replace(/\s+/g,' ');
 if(['isc','icse','cisce','cisce / icse / isc','council for the indian school certificate examinations'].includes(board)||/^cisce\s*\/\s*icse\s*\/\s*isc$/.test(board))return 'isc';
 if(['cbse','central board of secondary education'].includes(board))return 'cbse';
 return board;
}
