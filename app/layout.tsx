import {Suspense} from 'react';
import {DishaOnboarding} from '@/components/disha-onboarding';
import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = {title:'VIKAS · Your next step',description:'A simple space to explore, learn, and grow.'};
export default function Layout({children}:{children:React.ReactNode}) {return <html lang="en" suppressHydrationWarning><body>{children}<Suspense fallback={null}><DishaOnboarding/></Suspense></body></html>;}
