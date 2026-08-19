// Leaderboard backend (Supabase). Leave blank to disable the leaderboard.
// The anon key is designed to be public; row-level security limits it to
// inserting and reading scores.
window.LEADERBOARD = {
  url: "",     // e.g. "https://abcdefgh.supabase.co"
  anonKey: ""  // Project Settings -> API keys -> anon / publishable key
};
