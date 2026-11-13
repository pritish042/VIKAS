# Cinematic theme and entrance

The original landing layout, content and navigation are retained. Dark mode uses midnight charcoal, blue-black surfaces, burgundy landing CTAs, aquamist accents, sage support and ivory text. Existing light/system preferences and the first-paint theme bootstrap remain intact.

CSS entrances start when markup renders. Headline lines use 560/640/720ms durations, without delayed starts or invisible content. Wordmark/navigation, atmospheric lighting, process illustration and DISHA have finite complementary entrances. Existing restrained platform transitions remain. No animation dependencies were added.

`LandingAtmosphere` progressively enhances pointer lighting and process-card parallax using one requestAnimationFrame at a time. Touch, reduced motion and hidden tabs suppress pointer work. IntersectionObserver triggers finite lower-section entrances without hiding offscreen content. Listeners and observers are cleaned up. Theme transitions target colors/borders/shadows, rather than animating the whole page. There are no intro gates, loading delays, or additional provider requests.

Validation on 13 November 2026: typecheck and 183 tests passed. Production Chrome verified dark/light/system hard refreshes, persisted light selection, 1440/768/390/320px layouts, reduced-motion CSS and existing tutor routing. Local initial FCP samples were 116–668ms, with initial CLS 0. These are isolated localhost observations, not network-throttled production benchmarks or proof of sustained 60 FPS. Other engines and lower-powered physical devices remain unverified. No deployment occurred.
