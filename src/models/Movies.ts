export type Movie = {
  id: string;
  title: string;
  requester: string;
  requested_by?: string | null;
  date_submitted: string;
  rank: number;
  tmdb_id?: number | null;
  watched_at?: string | null;
};
