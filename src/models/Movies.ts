export type MovieUserTag = {
  tag: { slug: string; label: string };
  user: { id: string; display_name?: string | null; username: string };
  value?: string | null;
};

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
