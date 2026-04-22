export type Movie = {
  id: string;
  title: string;
  requester: string;
  requested_by?: string | null;
  date_submitted: string;
  elo_rank: number | null;
  tmdb_id?: number | null;
  watched_at?: string | null;
};
