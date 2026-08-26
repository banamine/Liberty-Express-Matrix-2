export const BACKEND_URL = import.meta.env.DEV
  ? ''
  : (import.meta.env.VITE_API_URL || 'https://ajn-archive-iptv-player-382115576551.us-west2.run.app');
