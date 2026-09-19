export type ContentKind = 'movie' | 'show';

// The kind-agnostic view within the app. Kind is orthogonal (D-7): the same
// view renders for either kind. `admin` is kind-agnostic. Shared by App and
// Navbar so the two never drift.
export type ViewName = 'queue' | 'this-or-that' | 'combined-list' | 'history' | 'admin';

export type MovieUserTag = {
  tag: { slug: string; label: string };
  user: { id: string; display_name?: string | null; username: string };
  value?: string | null;
};

// Structurally identical to MovieUserTag — shows reuse the shared `tags`
// definitions. Kept as a distinct name so the two stacks read symmetrically.
export type ShowUserTag = MovieUserTag;

export type Movie = {
  id: string;
  title: string;
  requester: string;
  requested_by?: string | null;
  date_submitted: string;
  elo_rank: number | null;
  tmdb_id?: number | null;
  watched_at?: string | null;
  poster_url?: string | null;
  myTags?: MovieUserTag[];
  userTags?: MovieUserTag[];
};

export type Show = {
  id: string;
  title: string;
  requester: string;
  requested_by?: string | null;
  date_submitted: string;
  elo_rank: number | null;
  tmdb_id?: number | null;
  watched_at?: string | null;
  poster_url?: string | null;
  first_air_year?: string | null;
  created_by?: string[];
  networks?: string[];
  number_of_seasons?: number | null;
  number_of_episodes?: number | null;
  status?: string | null;
  // Household-shared manual episode progress (issue #107). `next_season`/
  // `next_episode` are the raw values (used to prefill the progress editor);
  // `episode_progress` is the derived "S2 · E4" chip label, null unless both
  // raw values are set.
  next_season?: number | null;
  next_episode?: number | null;
  episode_progress?: string | null;
  myTags?: ShowUserTag[];
  userTags?: ShowUserTag[];
};

export type ContentItem = Movie | Show;
