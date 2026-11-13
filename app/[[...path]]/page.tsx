import {LandingPage} from '@/components/landing-page';
// The persistent root workspace decides which route to display. Keeping this
// presentation synchronous avoids hiding the public page in an async boundary.
// VikasApp renders this slot only for landing routes; authenticated pages retain
// their existing state, route selection and access checks.
export default function Page(){return <LandingPage/>;}
