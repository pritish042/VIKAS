export const youtubePathways = [
  'class-11-12-science',
  'class-11-12-commerce',
  'class-11-12-arts-humanities',
  'diploma',
  'iti',
] as const;
export type YoutubePathway = typeof youtubePathways[number];
export type YoutubeDifficulty = 'foundation' | 'core' | 'advanced';
export const youtubeLanguages = ['English','Hindi','Bengali','Gujarati','Kannada','Malayalam','Marathi','Punjabi','Tamil','Telugu','Urdu'] as const;
export type YoutubeLanguage = typeof youtubeLanguages[number];
