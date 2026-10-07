// A tab-memory flag survives App Router page remounts. No academic or auth data.
let pending=false;
export function beginDishaAuthHandoff(){pending=true;}
export function hasDishaAuthHandoff(){return pending;}
export function clearDishaAuthHandoff(){pending=false;}
