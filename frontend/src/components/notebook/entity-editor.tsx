"use client";

import { useEffect, useMemo, useState } from "react";
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
  loading: () => <p className="form-hint">Opening your page…</p>,
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
  onClose,
  onSaved,
}: {
  kind: EntityType;
  item?: EditableEntity;
  types: LibraryType[];
  onClose: () => void;
  onSaved: (message: string, item?: EditableEntity) => void;
}) {
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
          progress: z.string(),
          description: z.string(),
          content: z.string(),
          color_token: z.string(),
          type_id: z.string(),
          url: z.string(),
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
          if (
            kind === "timeline_entry" &&
            !/^\d{4}-\d{2}-\d{2}$/.test(fields.event_date)
          )
            issue("event_date", "Choose a date.");
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
  const dirty = isDirty || blocksDirty;
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
    if (isSubmitting) return;
    if (
      !dirty ||
      window.confirm("Leave this page? Your unsaved edits will be lost.")
    )
      onClose();
  }
  async function save(fields: Fields) {
    setSaveError("");
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
        item ? "Changes saved. All yours." : `Your ${labels[kind]} has a home.`,
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
    setTypeBusy(true);
    setSaveError("");
    try {
      const created = await workspaceApi.addType(newType);
      setExtraTypes((previous) => [...previous, created]);
      setValue("type_id", created.id, { shouldDirty: true });
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
        item ? `A little edit to your ${labels[kind]}` : `A new ${labels[kind]}`
      }
      wide={kind === "note"}
      onClose={close}
    >
      {saveError && (
        <p className="error-note" role="alert">
          {saveError}
        </p>
      )}
      <form className="notebook-form" onSubmit={handleSubmit(save)}>
        <fieldset disabled={isSubmitting} className="contents">
          {kind !== "sticky_note" && (
            <label>
              Title
              <input
                autoFocus
                placeholder={
                  kind === "goal"
                    ? "Something worth working toward…"
                    : "Give it a name…"
                }
                {...register("title")}
                aria-invalid={!!errors.title}
              />
              {errors.title && (
                <span className="text-destructive">{errors.title.message}</span>
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
              />
              {errors.progress && (
                <span className="text-destructive">
                  {errors.progress.message}
                </span>
              )}
            </label>
          )}
          {(kind === "project" ||
            kind === "library_item" ||
            kind === "timeline_entry") && (
            <label>
              A little context · optional
              <textarea
                placeholder="What's the story?"
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
                  placeholder="Catch it before it drifts away…"
                  maxLength={10000}
                  {...register("content")}
                />
                {errors.content && (
                  <span className="text-destructive">
                    {errors.content.message}
                  </span>
                )}
              </label>
              <div>
                <span className="form-hint">
                  Pick a paper color. Just for the joy of it.
                </span>
                <div className="color-swatches mt-3">
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
                <select {...register("type_id")}>
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
                  <span className="text-destructive">
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
                </div>
              ) : (
                <button
                  className="ink-button ghost justify-self-start"
                  type="button"
                  onClick={() => setAddingType(true)}
                >
                  + Make your own type
                </button>
              )}
              <label>
                URL · optional
                <input
                  type="url"
                  placeholder="https://…"
                  {...register("url")}
                />
                {errors.url && (
                  <span className="text-destructive">{errors.url.message}</span>
                )}
              </label>
            </>
          )}
          {kind === "timeline_entry" && (
            <label>
              When did it happen?
              <input type="date" {...register("event_date")} />
              {errors.event_date && (
                <span className="text-destructive">
                  {errors.event_date.message}
                </span>
              )}
            </label>
          )}
          {kind === "note" && (
            <div>
              <p className="form-hint">
                A blank page. Type / for headings, lists, and checklists. Drag
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
              {dirty ? "Unsaved ink" : "Save when you're ready"}
            </span>
            <button type="button" className="ink-button ghost" onClick={close}>
              Cancel
            </button>
            <button type="submit" className="ink-button" disabled={typeBusy}>
              <Save size={14} />
              {isSubmitting ? "Saving…" : "Save to notebook"}
            </button>
          </div>
        </fieldset>
      </form>
    </NotebookDialog>
  );
}
