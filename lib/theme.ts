export type ThemePreference='light'|'dark'|'system';
export function themePreference(saved:string|null):ThemePreference{return saved==='light'||saved==='system'||saved==='dark'?saved:'dark';}
export function resolvedTheme(preference:ThemePreference,systemDark:boolean){return preference==='system'?(systemDark?'dark':'light'):preference;}
// Static first-paint bootstrap. Reads only the existing appearance preference.
export const themeBootstrap=`(()=>{let theme='dark';try{const saved=localStorage.getItem('vikas-theme');if(['light','dark','system'].includes(saved))theme=saved;}catch{}document.documentElement.dataset.theme=theme==='system'?(matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'):theme;})();`;
