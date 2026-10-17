"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Check, Save } from "lucide-react";
import { NotebookDialog } from "./dialog";
import {
  createGoal,
  createProject,
  updateGoal,
  updateProject,
} from "@/lib/goals-projects";
import { workspaceApi, type EntityType } from "@/lib/workspace";
import type {
  Goal,
  Project,
  Note,
  StickyNote,
  LibraryItem,
  LibraryType,
  TimelineEntry,
} from "@/types/domain";

const NoteEditor = dynamic(() => import("./note-editor"), {
  ssr: false,
  loading: () => <p className="form-hint" role="status">Loading editor…</p>,
});
export type EditableEntity =
  Goal | Project | Note | StickyNote | LibraryItem | TimelineEntry;
type Fields = {
  title: string;
  progress: string;
  description: string;
  content: string;
  color_token: string;
  type_id: string;
  url: string;
  event_date: string;
};
const colors = {
  yellow: "#faf1ba",
  sage: "#dce7d1",
  blush: "#f4d9d4",
  blue: "#dbe8ef",
  lavender: "#e6ddf1",
};
const labels: Record<EntityType, string> = {
  goal: "goal",
  project: "project",
  note: "note",
  sticky_note: "sticky note",
  library_item: "Library item",
  timeline_entry: "timeline entry",
};

export function EntityEditor({
  kind,
  item,
  types,
  onTypesChanged,
  onClose,
  onSaved,
}: {
  kind: EntityType;
  item?: EditableEntity;
  types: LibraryType[];
  onTypesChanged: () => void;
  onClose: () => void;
  onSaved: (message: string, item?: EditableEntity) => void;
}) {
  const formId = useId();
  const errorRef = useRef<HTMLParagraphElement>(null);
  const errorId = (field: keyof Fields) => `${formId}-${field}-error`;
  const existingNote = kind === "note" && item ? (item as Note) : null;
  const [blocks, setBlocks] = useState<unknown[]>(existingNote?.content ?? []);
  const [blocksDirty, setBlocksDirty] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [addingType, setAddingType] = useState(false);
  const [newType, setNewType] = useState("");
  const [extraTypes, setExtraTypes] = useState<LibraryType[]>([]);
  const [typeBusy, setTypeBusy] = useState(false);
  const schema = useMemo(
    () =>
      z
        .object({
          title: z.string(),
          progress: z.string().trim(),
          description: z.string(),
          content: z.string(),
          color_token: z.string(),
          type_id: z.string(),
          url: z.string().trim(),
          event_date: z.string(),
        })
        .superRefine((fields, ctx) => {
          const issue = (path: keyof Fields, message: string) =>
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              path: [path],
              message,
            });
          if (kind !== "sticky_note" && !fields.title.trim())
            issue("title", "Give this page a title.");
          if (kind === "sticky_note" && !fields.content.trim())
            issue("content", "Write a thought first.");
          if (
            kind === "goal" &&
            fields.progress !== "" &&
            (!Number.isInteger(Number(fields.progress)) ||
              Number(fields.progress) < 0 ||
              Number(fields.progress) > 100)
          )
            issue("progress", "Use a whole number from 0 to 100.");
          if (kind === "library_item") {
            if (!fields.type_id) issue("type_id", "Choose a Library type.");
            if (fields.url && !z.string().url().safeParse(fields.url).success)
              issue("url", "Use a complete URL.");
            if (fields.url && !/^https?:\/\//i.test(fields.url))
              issue("url", "Use an http or https URL.");
          }
          if (kind === "timeline_entry") {
            const date = new Date(fields.event_date + "T12:00:00Z");
            if (
              !/^\d{4}-\d{2}-\d{2}$/.test(fields.event_date) ||
              fields.event_date.startsWith("0000") ||
              !Number.isFinite(date.getTime()) ||
              date.toISOString().slice(0, 10) !== fields.event_date
            ) issue("event_date", "Choose a valid date.");
          }
        }),
    [kind],
  );
  const values: Fields = {
    title: item && "title" in item ? item.title : "",
    progress:
      item && "progress_percent" in item
        ? String(item.progress_percent ?? "")
        : "",
    description: item && "description" in item ? (item.description ?? "") : "",
    content: kind === "sticky_note" && item ? (item as StickyNote).content : "",
    color_token:
      kind === "sticky_note" && item
        ? ((item as StickyNote).color_token ?? "yellow")
        : "yellow",
    type_id: item && "type_id" in item ? item.type_id : (types[0]?.id ?? ""),
    url: item && "url" in item ? (item.url ?? "") : "",
    event_date:
      item && "event_date" in item
        ? item.event_date
        : new Date().toLocaleDateString("sv-SE"),
  };
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isDirty, isSubmitting },
  } = useForm<Fields>({ resolver: zodResolver(schema), defaultValues: values });
  const dirty = isDirty || blocksDirty || !!newType.trim();
  useEffect(() => {
    if (saveError) errorRef.current?.focus();
  }, [saveError]);
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
  function close() {
    if (isSubmitting || typeBusy) return;
    if (
      !dirty ||
      window.confirm("Leave this page? Your unsaved edits will be lost.")
    )
      onClose();
  }
  async function save(fields: Fields) {
    setSaveError("");
    if (addingType && newType.trim()) {
      setSaveError("Add or cancel the new type before saving this item.");
      return;
    }
    try {
      let result: EditableEntity;
      if (kind === "goal") {
        const input = {
          title: fields.title.trim(),
          progress_percent:
            fields.progress === "" ? null : Number(fields.progress),
        };
        result = item
          ? await updateGoal(item.id, input)
          : await createGoal(input);
      } else if (kind === "project") {
        const input = {
          title: fields.title.trim(),
          description: fields.description.trim() || null,
        };
        result = item
          ? await updateProject(item.id, input)
          : await createProject(input);
      } else if (kind === "note") {
        result = await workspaceApi.saveNote(
          { title: fields.title.trim(), content: blocks },
          item?.id,
        );
      } else if (kind === "sticky_note") {
        result = await workspaceApi.saveSticky(
          { content: fields.content.trim(), color_token: fields.color_token },
          item?.id,
        );
      } else if (kind === "library_item") {
        result = await workspaceApi.saveLibrary(
          {
            title: fields.title.trim(),
            description: fields.description.trim() || null,
            type_id: fields.type_id,
            url: fields.url.trim() || null,
          },
          item?.id,
        );
      } else {
        result = await workspaceApi.saveTimeline(
          {
            title: fields.title.trim(),
            description: fields.description.trim() || null,
            event_date: fields.event_date,
          },
          item?.id,
        );
      }
      onSaved(
        item ? "Changes saved." : `${labels[kind][0].toUpperCase() + labels[kind].slice(1)} saved.`,
        result,
      );
    } catch (error) {
      setSaveError(
        error instanceof Error
          ? error.message
          : "Could not save. Please try again.",
      );
    }
  }
  async function addType() {
    if (typeBusy || isSubmitting || !newType.trim()) return;
    setTypeBusy(true);
    setSaveError("");
    try {
      const created = await workspaceApi.addType(newType.trim());
      setExtraTypes((previous) => [...previous, created]);
      setValue("type_id", created.id, { shouldDirty: true, shouldValidate: true });
      onTypesChanged();
      setAddingType(false);
      setNewType("");
    } catch (error) {
      setSaveError(
        error instanceof Error ? error.message : "Could not add this type.",
      );
    } finally {
      setTypeBusy(false);
    }
  }
  return (
    <NotebookDialog
      title={
        item ? `Edit ${labels[kind]}` : `New ${labels[kind]}`
      }
      wide={kind === "note"}
      onClose={close}
      closeDisabled={isSubmitting || typeBusy}
    >
      {saveError && (
        <p className="error-note" role="alert" ref={errorRef} tabIndex={-1}>
          {saveError}
        </p>
      )}
      <form
        className="notebook-form"
        onSubmit={handleSubmit(save)}
        aria-busy={isSubmitting || typeBusy}
        onKeyDown={(event) => {
          if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
            event.preventDefault();
            if (!isSubmitting && !typeBusy) void handleSubmit(save)();
          }
        }}
      >
        <fieldset disabled={isSubmitting || typeBusy} className="contents">
          {kind !== "sticky_note" && (
            <label>
              Title
              <input
                autoFocus
                placeholder={
                  kind === "goal"
                    ? "Goal title"
                    : "Title"
                }
                {...register("title")}
                aria-invalid={!!errors.title}
                aria-describedby={errors.title ? errorId("title") : undefined}
              />
              {errors.title && (
                <span className="text-destructive" id={errorId("title")}>{errors.title.message}</span>
              )}
            </label>
          )}
          {kind === "goal" && (
            <label>
              Progress · optional
              <input
                type="number"
                min="0"
                max="100"
                step="1"
                placeholder="Leave blank if a percentage doesn't fit"
                {...register("progress")}
                aria-invalid={!!errors.progress}
                aria-describedby={errors.progress ? errorId("progress") : undefined}
              />
              {errors.progress && (
                <span className="text-destructive" id={errorId("progress")}>
                  {errors.progress.message}
                </span>
              )}
            </label>
          )}
          {(kind === "project" ||
            kind === "library_item" ||
            kind === "timeline_entry") && (
            <label>
              Description · optional
              <textarea
                placeholder="Description"
                maxLength={kind === "project" ? undefined : 20000}
                {...register("description")}
              />
            </label>
          )}
          {kind === "sticky_note" && (
            <>
              <label>
                Your thought
                <textarea
                  autoFocus
                  placeholder="Write a note"
                  maxLength={10000}
                  {...register("content")}
                  aria-invalid={!!errors.content}
                  aria-describedby={errors.content ? errorId("content") : undefined}
                />
                {errors.content && (
                  <span className="text-destructive" id={errorId("content")}>
                    {errors.content.message}
                  </span>
                )}
              </label>
              <div>
                <span className="form-hint" id={`${formId}-paper-color`}>
                  Paper color
                </span>
                <div className="color-swatches mt-3" role="group" aria-labelledby={`${formId}-paper-color`}>
                  {Object.entries(colors).map(([color, fill]) => (
                    <button
                      key={color}
                      type="button"
                      aria-label={`${color} paper`}
                      aria-pressed={watch("color_token") === color}
                      className={`color-swatch ${watch("color_token") === color ? "selected" : ""}`}
                      style={{ background: fill }}
                      onClick={() =>
                        setValue("color_token", color, { shouldDirty: true })
                      }
                    >
                      {watch("color_token") === color && (
                        <Check size={14} className="m-auto" />
                      )}
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}
          {kind === "library_item" && (
            <>
              <label>
                Type
                <select
                  {...register("type_id")}
                  aria-invalid={!!errors.type_id}
                  aria-describedby={errors.type_id ? errorId("type_id") : undefined}
                >
                  <option value="">Choose a type</option>
                  {Array.from(
                    new Map(
                      [...types, ...extraTypes].map((type) => [type.id, type]),
                    ).values(),
                  ).map((type) => (
                    <option key={type.id} value={type.id}>
                      {type.name}
                    </option>
                  ))}
                </select>
                {errors.type_id && (
                  <span className="text-destructive" id={errorId("type_id")}>
                    {errors.type_id.message}
                  </span>
                )}
              </label>
              {addingType ? (
                <div className="flex flex-wrap items-end gap-2">
                  <label className="flex-1">
                    New reusable type
                    <input
                      value={newType}
                      onChange={(event) => setNewType(event.target.value)}
                      placeholder="e.g. Podcast"
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          event.preventDefault();
                          event.stopPropagation();
                          void addType();
                        } else if (event.key === "Escape") {
                          event.preventDefault();
                          event.stopPropagation();
                          setAddingType(false);
                          setNewType("");
                        }
                      }}
                    />
                  </label>
                  <button
                    type="button"
                    className="ink-button secondary"
                    disabled={typeBusy || !newType.trim()}
                    onClick={addType}
                  >
                    {typeBusy ? "Adding…" : "Add type"}
                  </button>
                  <button
                    type="button"
                    className="ink-button ghost"
                    disabled={typeBusy}
                    onClick={() => {
                      setAddingType(false);
                      setNewType("");
                    }}
                  >
                    Cancel type
                  </button>
                </div>
              ) : (
                <button
                  className="ink-button ghost justify-self-start"
                  type="button"
                  onClick={() => setAddingType(true)}
                >
                  + Add a type
                </button>
              )}
              <label>
                URL · optional
                <input
                  type="url"
                  placeholder="https://…"
                  {...register("url")}
                  aria-invalid={!!errors.url}
                  aria-describedby={errors.url ? errorId("url") : undefined}
                />
                {errors.url && (
                  <span className="text-destructive" id={errorId("url")}>{errors.url.message}</span>
                )}
              </label>
            </>
          )}
          {kind === "timeline_entry" && (
            <label>
              Date
              <input
                type="date"
                min="0001-01-01"
                max="9999-12-31"
                {...register("event_date")}
                aria-invalid={!!errors.event_date}
                aria-describedby={errors.event_date ? errorId("event_date") : undefined}
              />
              {errors.event_date && (
                <span className="text-destructive" id={errorId("event_date")}>
                  {errors.event_date.message}
                </span>
              )}
            </label>
          )}
          {kind === "note" && (
            <div>
              <p className="form-hint">
                Type / for headings, lists, and checklists. Drag
                the handle beside a block to reorder it.
              </p>
              <NoteEditor
                content={blocks}
                onChange={(content) => {
                  setBlocks(content);
                  setBlocksDirty(true);
                }}
                readOnly={isSubmitting}
              />
            </div>
          )}
          <div className="form-actions">
            <span className="form-hint mr-auto">
              {isSubmitting ? "Saving…" : dirty ? "Unsaved changes" : ""}
            </span>
            <button type="button" className="ink-button ghost" onClick={close}>
              Cancel
            </button>
            <button
              type="submit"
              className="ink-button"
              disabled={typeBusy}
              aria-keyshortcuts="Control+Enter Meta+Enter"
              title="Save (Ctrl or ⌘ Enter)"
            >
              <Save size={14} />
              {isSubmitting ? "Saving…" : "Save to notebook"}
            </button>
          </div>
        </fieldset>
      </form>
    </NotebookDialog>
  );
}
