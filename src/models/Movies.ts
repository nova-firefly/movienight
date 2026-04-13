export type MovieVote = {
  userId: string;
  username: string;
  displayName?: string | null;
  vote: boolean | null;
};

export type Movie = {
  id: string;
  title: string;
  requester: string;
  requested_by?: string | null;
  date_submitted: string;
  rank: number;
  tmdb_id?: number | null;
  watched_at?: string | null;
  votes: MovieVote[];
};
