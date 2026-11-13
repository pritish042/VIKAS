import {themeBootstrap} from '@/lib/theme';
import VikasApp from '@/components/vikas-app';
import {DishaOnboarding} from '@/components/disha-onboarding';
import type { Metadata } from 'next';
import './globals.css';
import './stitch.css';
import './landing-motion.css';
export const metadata: Metadata = {title:'VIKAS · Your next step',description:'A simple space to explore, learn, and grow.'};
export default function Layout({children}:{children:React.ReactNode}) {return <html lang="en" data-theme="dark" suppressHydrationWarning><head><link rel="preload" href="/fonts/syne-700.woff2" as="font" type="font/woff2" crossOrigin="anonymous"/><script dangerouslySetInnerHTML={{__html:themeBootstrap}}/></head><body><VikasApp landing={children}/><DishaOnboarding/></body></html>;}
