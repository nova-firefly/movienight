export type Movie = {
  id: string;
  title: string;
  requester: string;
  date_submitted: string;
  rank: number;
  tmdb_id?: number | null;
};
