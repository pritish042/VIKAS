import type {CSSProperties} from 'react';

/** Shared by the CSS-first landing presentation and its optional JS/3D enhancements. */
export const landingMotion={controlMs:180,sectionMs:480,entranceMs:640,themeMs:500,springResponse:7.5,ease:'cubic-bezier(.22,.7,.2,1)'} as const;
export const landingMotionStyle={
 '--motion-control':`${landingMotion.controlMs}ms`,
 '--motion-section':`${landingMotion.sectionMs}ms`,
 '--motion-entrance':`${landingMotion.entranceMs}ms`,
 '--motion-theme':`${landingMotion.themeMs}ms`,
 '--motion-ease':landingMotion.ease,
} as CSSProperties;
