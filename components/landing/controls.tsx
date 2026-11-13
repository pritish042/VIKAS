'use client';
import {createContext,useContext,type ReactNode} from 'react';
import Link from 'next/link';
import {ArrowRight} from 'lucide-react';
import {landingAction} from '@/lib/navigation';
const Preferences=createContext<{signedIn:boolean;themeControl:ReactNode}>({signedIn:false,themeControl:null});
export function useLandingPreferences(){return useContext(Preferences);}
export function LandingPreferencesProvider({signedIn,themeControl,children}:{signedIn:boolean;themeControl:ReactNode;children:ReactNode}){return <Preferences.Provider value={{signedIn,themeControl}}>{children}</Preferences.Provider>;}
export function LandingAction({header=false}:{header?:boolean}){const {signedIn}=useContext(Preferences),action=landingAction(signedIn);return <Link href={action.href} className={`primary${header?' lp-header-cta':''}`}>{action.label}{!header&&<ArrowRight size={17} aria-hidden="true"/>}</Link>;}
export function LandingHeaderControls(){const {signedIn,themeControl}=useContext(Preferences);return <>{themeControl}{!signedIn&&<Link href="/login" className="lp-sign-in">Sign in</Link>}<LandingAction header/></>;}
