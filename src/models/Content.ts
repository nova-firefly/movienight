export type ContentKind = 'movie' | 'show';

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
  myTags?: ShowUserTag[];
  userTags?: ShowUserTag[];
};

export type ContentItem = Movie | Show;
