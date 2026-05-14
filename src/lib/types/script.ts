export interface Script {
  id: string;
  user_id: string;
  title: string;
  niche: string | null;
  topic: string | null;
  content: string;
  word_count: number;
  estimated_duration: number;
  source_video_id: string | null;
  structure_pattern: string | null;
  created_at: string;
  updated_at: string;
}
