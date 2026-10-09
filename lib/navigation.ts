export type AppPage='aprajita'|'landing'|'start'|'home'|'explore'|'plan'|'mentor'|'profile'|'login'|'signup'|'forgot'|'reset'|'privacy';
const routes:Record<string,AppPage>={aprajita:'aprajita',start:'start',onboarding:'start',home:'home',today:'home',plan:'plan',journey:'plan',mentor:'mentor',disha:'mentor',explore:'explore',learn:'explore',labs:'aprajita',profile:'profile',login:'login',signup:'signup',forgot:'forgot',reset:'reset',privacy:'privacy'};
export function pageForPath(path:string):AppPage {return routes[path.split('/')[1]]||'landing';}
export function pathForPage(page:AppPage){return ({landing:'/',start:'/start',home:'/today',plan:'/journey',mentor:'/disha',explore:'/learn',aprajita:'/labs'} as Partial<Record<AppPage,string>>)[page]||`/${page}`;}
export function landingAction(signedIn:boolean){return signedIn?{href:'/today',label:'Continue your journey'}:{href:'/start',label:'Get started'};}

export const mainDestinations=['home','explore','aprajita','plan'] as const;
export function navigationSection(page:AppPage):AppPage{return page==='mentor'?'explore':page;}
