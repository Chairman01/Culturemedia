// Culture Alberta's social accounts and their follower counts, for the
// Valuation page. Counted by hand from each public profile; refresh them with
// the Wednesday data drop. Nothing here posts to or reads from the platforms.

export type SocialPlatform = 'instagram' | 'threads' | 'bluesky' | 'facebook' | 'tiktok' | 'youtube' | 'x' | 'linkedin' | 'pinterest';

export interface SocialAccount {
  platform: SocialPlatform;
  handle: string;
  url: string;
  followers: number;
  /** YYYY-MM-DD the count was read. */
  countedOn: string;
}

export const SOCIAL_ACCOUNTS: SocialAccount[] = [
  { platform: 'instagram', handle: '@culturealberta._', url: 'https://www.instagram.com/culturealberta._/', followers: 20_800, countedOn: '2026-09-24' },
  { platform: 'instagram', handle: '@cultureyyc._', url: 'https://www.instagram.com/cultureyyc._/', followers: 22_400, countedOn: '2026-09-24' },
  { platform: 'threads', handle: '@culturealberta._', url: 'https://www.threads.com/@culturealberta._', followers: 3_258, countedOn: '2026-09-24' },
  { platform: 'threads', handle: '@cultureyyc._', url: 'https://www.threads.com/@cultureyyc._', followers: 3_200, countedOn: '2026-09-24' },
  { platform: 'bluesky', handle: '@culturealberta.bsky.social', url: 'https://bsky.app/profile/culturealberta.bsky.social', followers: 2_241, countedOn: '2026-09-24' },
];

export const PLATFORM_NAME: Record<SocialPlatform, string> = {
  instagram: 'Instagram',
  threads: 'Threads',
  bluesky: 'Bluesky',
  facebook: 'Facebook',
  tiktok: 'TikTok',
  youtube: 'YouTube',
  x: 'X',
  linkedin: 'LinkedIn',
  pinterest: 'Pinterest',
};
