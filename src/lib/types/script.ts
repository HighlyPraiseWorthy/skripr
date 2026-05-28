export interface ScriptVersion {
  content: string;
  savedAt: string;
  label: string;
  wordCount: number;
}

export interface ScriptVersion {
  content: string;
  savedAt: string;
  label: string;
  wordCount: number;
}

export interface Script {
  id: string;
  user_id: string;
  title: string;
  niche: string | null;
  topic: string | null;
  content: string;
  word_count: number | null;
  estimated_duration: number | null;
  source_video_id: string | null;
  structure_pattern: string | { sections?: unknown[] } | null;
  hook_type: string | null;
  metadata: Record<string, unknown> | null;
  compliance_score: number | null;
  status: string | null;
  created_at: string;
  updated_at: string;
  versions?: ScriptVersion[];
}
