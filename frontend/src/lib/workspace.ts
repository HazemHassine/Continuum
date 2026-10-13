import { apiClient } from "./api-client";
import type {
  EntityLink,
  LibraryItem,
  LibraryType,
  Note,
  StickyNote,
  TimelineEntry,
} from "@/types/domain";

export type EntityType =
  | "goal"
  | "project"
  | "note"
  | "sticky_note"
  | "library_item"
  | "timeline_entry";
export type View =
  "today" | "goals" | "projects" | "notes" | "library" | "timeline" | "archive";
export interface EntityRef {
  id: string;
  type: EntityType;
  title: string;
}
export const workspaceApi = {
  notes: (archived = false) =>
    apiClient<Note[]>(`/api/v1/notes?archived=${archived}`),
  stickies: (archived = false) =>
    apiClient<StickyNote[]>(`/api/v1/sticky-notes?archived=${archived}`),
  library: () => apiClient<LibraryItem[]>("/api/v1/library"),
  types: () => apiClient<LibraryType[]>("/api/v1/library-types"),
  timeline: () => apiClient<TimelineEntry[]>("/api/v1/timeline"),
  links: () => apiClient<EntityLink[]>("/api/v1/links"),
  saveNote: (input: { title: string; content: unknown[] }, id?: string) =>
    apiClient<Note>(`/api/v1/notes${id ? `/${id}` : ""}`, {
      method: id ? "PUT" : "POST",
      body: JSON.stringify(input),
    }),
  saveSticky: (input: { content: string; color_token: string }, id?: string) =>
    apiClient<StickyNote>(`/api/v1/sticky-notes${id ? `/${id}` : ""}`, {
      method: id ? "PUT" : "POST",
      body: JSON.stringify(input),
    }),
  saveLibrary: (
    input: {
      title: string;
      type_id: string;
      url: string | null;
      description: string | null;
    },
    id?: string,
  ) =>
    apiClient<LibraryItem>(`/api/v1/library${id ? `/${id}` : ""}`, {
      method: id ? "PUT" : "POST",
      body: JSON.stringify(input),
    }),
  saveTimeline: (
    input: { title: string; event_date: string; description: string | null },
    id?: string,
  ) =>
    apiClient<TimelineEntry>(`/api/v1/timeline${id ? `/${id}` : ""}`, {
      method: id ? "PUT" : "POST",
      body: JSON.stringify(input),
    }),
  addType: (name: string) =>
    apiClient<LibraryType>("/api/v1/library-types", {
      method: "POST",
      body: JSON.stringify({ name }),
    }),
  archive: (type: "notes" | "sticky-notes", id: string) =>
    apiClient(`/api/v1/${type}/${id}/archive`, { method: "POST" }),
  promote: (id: string) =>
    apiClient<Note>(`/api/v1/sticky-notes/${id}/promote`, { method: "POST" }),
  link: (source: EntityRef, target: EntityRef) =>
    apiClient<EntityLink>("/api/v1/links", {
      method: "POST",
      body: JSON.stringify({
        source_type: source.type,
        source_id: source.id,
        target_type: target.type,
        target_id: target.id,
      }),
    }),
  unlink: (id: string) =>
    apiClient<void>(`/api/v1/links/${id}`, { method: "DELETE" }),
};

export function notePreview(content: unknown[]): string {
  const text = (value: unknown): string => {
    if (typeof value === "string") return value;
    if (Array.isArray(value)) return value.map(text).join(" ");
    if (value && typeof value === "object") {
      const object = value as {
        text?: string;
        content?: unknown;
        children?: unknown;
      };
      return (
        object.text ?? [text(object.content), text(object.children)].join(" ")
      );
    }
    return "";
  };
  return text(content).trim();
}
