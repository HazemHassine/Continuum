export type GoalStatus = "active" | "completed";
export type ProjectStatus = "active" | "paused" | "completed" | "abandoned";

export interface Profile {
  id: string;
  onboarding_completed_at: string | null;
  created_at: string;
}

export interface Goal {
  id: string;
  user_id: string;
  title: string;
  status: GoalStatus;
  progress_percent: number | null;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
  archived_at: string | null;
  is_archived?: boolean;
  in_grace_period?: boolean;
}

export interface Project {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  status: ProjectStatus;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
  archived_at: string | null;
  is_archived?: boolean;
  in_grace_period?: boolean;
}

export interface Note {
  id: string;
  user_id: string;
  title: string;
  content: unknown[]; // BlockNote JSON blocks
  created_at: string;
  updated_at: string;
  archived_at: string | null;
}

export interface StickyNote {
  id: string;
  user_id: string;
  content: string;
  color_token: string | null;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
}

export interface TimelineEntry {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  event_date: string;
  created_at: string;
  updated_at: string;
}

export interface LibraryType {
  slug: string;
  id: string;
  user_id: string | null;
  name: string;
  is_system: boolean;
  created_at: string;
}

export interface LibraryItem {
  id: string;
  user_id: string;
  type_id: string;
  title: string;
  url: string | null;
  description: string | null;
  created_at: string;
  updated_at: string;
}

export interface EntityLink {
  id: string;
  user_id: string;
  source_type: string;
  source_id: string;
  target_type: string;
  target_id: string;
  created_at: string;
}
