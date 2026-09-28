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
  progress: number | null;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
  archive_at: string | null;
}

export interface Project {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  status: ProjectStatus;
  created_at: string;
  updated_at: string;
  closed_at: string | null;
  archive_at: string | null;
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
  color_variant: string | null;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
}

export interface TimelineEntry {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  occurred_on: string;
  created_at: string;
  updated_at: string;
}

export interface LibraryType {
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
