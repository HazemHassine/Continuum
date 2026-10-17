"use client";

import { Suspense, useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { useRouter, useSearchParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Archive,
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  Check,
  CheckCircle2,
  Clock3,
  FileText,
  Flag,
  FolderOpen,
  Link2,
  LogOut,
  Plus,
  Pencil,
  Search,
  StickyNote as StickyIcon,
  X,
} from "lucide-react";
import { useAuth } from "@/context/auth-context";
import { ApiError, apiClient } from "@/lib/api-client";
import {
  getGoals,
  getProjects,
  updateGoal,
  updateProject,
} from "@/lib/goals-projects";
import {
  notePreview,
  workspaceApi,
  type EntityRef,
  type EntityType,
  type View,
} from "@/lib/workspace";
import type {
  EntityLink,
  Goal,
  LibraryItem,
  Note,
  Project,
  ProjectStatus,
  StickyNote,
  TimelineEntry,
} from "@/types/domain";
import { NotebookLogo, Paper } from "./sketch";
import { NotebookDialog } from "./dialog";
import { EntityEditor, type EditableEntity } from "./entity-editor";
import { Connections, otherEnd } from "./connections";

const NoteEditor = dynamic(() => import("./note-editor"), {
  ssr: false,
  loading: () => <p className="form-hint" role="status">Loading note…</p>,
});
const pages = [
  { view: "today", label: "Today" },
  { view: "goals", label: "Goals" },
  { view: "projects", label: "Projects" },
  { view: "notes", label: "Notes" },
  { view: "library", label: "Library" },
  { view: "timeline", label: "Timeline" },
  { view: "archive", label: "Archive" },
] as const;
const sectionDescriptions: Partial<Record<View, string>> = {
  timeline: "Moments you choose to remember.",
  archive: "Completed work and archived notes.",
};
const typeNames: Record<EntityType, string> = {
  goal: "Goal",
  project: "Project",
  note: "Note",
  sticky_note: "Sticky note",
  library_item: "Library item",
  timeline_entry: "Timeline entry",
};
const icons = {
  goal: Flag,
  project: FolderOpen,
  note: FileText,
  sticky_note: StickyIcon,
  library_item: BookOpen,
  timeline_entry: Clock3,
};
type Modal =
  | { kind: "edit"; type: EntityType; item?: EditableEntity }
  | { kind: "links"; source: EntityRef }
  | { kind: "read"; title: string; content?: unknown[]; description?: string }
  | { kind: "quick" }
  | { kind: "onboard" };

function shortDate(date: string) {
  return new Date(
    date.length === 10 ? date + "T12:00:00" : date,
  ).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
function Empty({
  title,
  description,
  action,
  onAdd,
}: {
  icon: typeof Flag;
  title: string;
  description: string;
  action?: string;
  onAdd?: () => void;
}) {
  return (
    <div className="empty-state">
      <h3>{title}</h3>
      <p>{description}</p>
      {action && onAdd && (
        <button className="ink-button secondary small" onClick={onAdd}>
          <Plus size={12} />
          {action}
        </button>
      )}
    </div>
  );
}
function Section({
  title,
  view,
  children,
  className = "",
}: {
  title: string;
  icon: typeof Flag;
  view?: View;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`daily-section ${className}`}>
      <div className="section-heading">
        <div className="section-title">
          <h2>{title}</h2>
        </div>
        {view && (
          <Link href={`/dashboard?view=${view}`} className="view-all">
            Open <ArrowUpRight size={12} />
          </Link>
        )}
      </div>
      {children}
    </section>
  );
}
function LinkedChips({
  source,
  links,
  entities,
}: {
  source: EntityRef;
  links: EntityLink[];
  entities: EntityRef[];
}) {
  const targets = links.map((link) => otherEnd(link, source)).filter(Boolean);
  if (!targets.length) return null;
  return (
    <div className="link-chips">
      {targets.map((target) => {
        const found = entities.find(
          (entity) => entity.type === target!.type && entity.id === target!.id,
        );
        return (
          <span className="link-chip" key={`${target!.type}:${target!.id}`}>
            <Link2 size={10} />
            <span>{found?.title ?? "Connected entry"}</span>
          </span>
        );
      })}
    </div>
  );
}
function NotebookWorkspace() {
  const router = useRouter();
  const params = useSearchParams();
  const requested = params.get("view");
  const view: View = pages.some((page) => page.view === requested)
    ? (requested as View)
    : "today";
  const {
    user,
    isLoading: authLoading,
    sessionError,
    retrySession,
    signOut,
    refreshProfile,
  } = useAuth();
  const cache = useQueryClient();
  const queryKey = ["notebook", user?.id];
  const [modal, setModal] = useState<Modal | null>(null);
  const options = {
    enabled: !!user,
    refetchOnWindowFocus: true,
    retry: (failures: number, error: Error) =>
      !(error instanceof ApiError && error.status >= 400 && error.status < 500) &&
      failures < 1,
  };
  const needsArchivedNotes = view === "archive" || modal?.kind === "links";
  const goalsQuery = useQuery({
    queryKey: [...queryKey, "goals"],
    queryFn: () => getGoals("all"),
    ...options,
    refetchInterval: 30_000,
  });
  const projectsQuery = useQuery({
    queryKey: [...queryKey, "projects"],
    queryFn: () => getProjects("all"),
    ...options,
    refetchInterval: 30_000,
  });
  const notesQuery = useQuery({
    queryKey: [...queryKey, "notes"],
    queryFn: () => workspaceApi.notes(),
    ...options,
  });
  const archivedNotesQuery = useQuery({
    queryKey: [...queryKey, "archived-notes"],
    queryFn: () => workspaceApi.notes(true),
    ...options,
    enabled: !!user && needsArchivedNotes,
  });
  const stickyQuery = useQuery({
    queryKey: [...queryKey, "sticky"],
    queryFn: () => workspaceApi.stickies(),
    ...options,
  });
  const archivedStickyQuery = useQuery({
    queryKey: [...queryKey, "archived-sticky"],
    queryFn: () => workspaceApi.stickies(true),
    ...options,
    enabled: !!user && needsArchivedNotes,
  });
  const libraryQuery = useQuery({
    queryKey: [...queryKey, "library"],
    queryFn: workspaceApi.library,
    ...options,
  });
  const typesQuery = useQuery({
    queryKey: [...queryKey, "types"],
    queryFn: workspaceApi.types,
    ...options,
  });
  const timelineQuery = useQuery({
    queryKey: [...queryKey, "timeline"],
    queryFn: workspaceApi.timeline,
    ...options,
  });
  const linksQuery = useQuery({
    queryKey: [...queryKey, "links"],
    queryFn: workspaceApi.links,
    ...options,
  });
  const [search, setSearch] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [filter, setFilter] = useState("all");
  const [toast, setToast] = useState("");
  const [step, setStep] = useState(0);
  const [onboardingError, setOnboardingError] = useState("");
  const [onboardingBusy, setOnboardingBusy] = useState(false);
  const searchInput = useRef<HTMLInputElement>(null);
  const onboardShown = useRef(false);
  const goals = goalsQuery.data ?? [],
    projects = projectsQuery.data ?? [],
    notes = notesQuery.data ?? [],
    stickies = stickyQuery.data ?? [];
  const library = libraryQuery.data ?? [],
    types = typesQuery.data ?? [],
    timeline = timelineQuery.data ?? [],
    links = linksQuery.data ?? [];
  const archiveNotes = archivedNotesQuery.data ?? [],
    archiveStickies = archivedStickyQuery.data ?? [];
  const activeGoals = goals.filter((goal) => !goal.is_archived),
    activeProjects = projects.filter((project) => !project.is_archived);
  const entities: EntityRef[] = [
    ...goals.map((item) => ({
      id: item.id,
      type: "goal" as const,
      title: item.title,
    })),
    ...projects.map((item) => ({
      id: item.id,
      type: "project" as const,
      title: item.title,
    })),
    ...[...notes, ...archiveNotes].map((item) => ({
      id: item.id,
      type: "note" as const,
      title: item.title,
    })),
    ...[...stickies, ...archiveStickies].map((item) => ({
      id: item.id,
      type: "sticky_note" as const,
      title: item.content.split("\n")[0].slice(0, 80),
    })),
    ...library.map((item) => ({
      id: item.id,
      type: "library_item" as const,
      title: item.title,
    })),
    ...timeline.map((item) => ({
      id: item.id,
      type: "timeline_entry" as const,
      title: item.title,
    })),
  ];
  const mutation = useMutation({
    mutationFn: async ({
      action,
      message,
    }: {
      action: () => Promise<unknown>;
      message: string;
    }) => {
      await action();
      return message;
    },
    onSuccess: async (message) => {
      await cache.invalidateQueries({ queryKey: ["notebook", user?.id] });
      setToast(message);
    },
  });
  useEffect(() => {
    if (!authLoading && !user && !sessionError) router.replace("/login");
  }, [authLoading, user, sessionError, router]);
  useEffect(() => {
    if (user && !user.onboarding_completed_at && !onboardShown.current) {
      onboardShown.current = true;
      setModal({ kind: "onboard" });
    }
  }, [user]);
  useEffect(() => {
    setSearch("");
    setFilter("all");
    setSearchOpen(false);
  }, [view]);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(""), 4500);
    return () => clearTimeout(timer);
  }, [toast]);
  useEffect(() => {
    if (searchOpen) searchInput.current?.focus();
  }, [searchOpen]);
  useEffect(() => {
    const shortcut = (event: KeyboardEvent) => {
      if (
        (event.metaKey || event.ctrlKey) &&
        event.key.toLowerCase() === "k" &&
        !document.querySelector("dialog[open]")
      ) {
        event.preventDefault();
        setSearchOpen(true);
        searchInput.current?.focus();
      }
    };
    window.addEventListener("keydown", shortcut);
    return () => window.removeEventListener("keydown", shortcut);
  }, []);
  const queries = [
    goalsQuery,
    projectsQuery,
    notesQuery,
    archivedNotesQuery,
    stickyQuery,
    archivedStickyQuery,
    libraryQuery,
    typesQuery,
    timelineQuery,
    linksQuery,
  ];
  const pageQueries = {
    today: [
      goalsQuery, projectsQuery, notesQuery, stickyQuery, libraryQuery,
      typesQuery, timelineQuery, linksQuery,
    ],
    goals: [goalsQuery, linksQuery],
    projects: [projectsQuery, linksQuery],
    notes: [notesQuery, linksQuery],
    library: [libraryQuery, typesQuery, linksQuery],
    timeline: [timelineQuery, linksQuery],
    archive: [
      goalsQuery, projectsQuery, archivedNotesQuery, archivedStickyQuery, linksQuery,
    ],
  }[view];
  const loading = pageQueries.some((query) => query.isPending);
  const pageUnavailable = pageQueries.some(
    (query) => query.isError && query.data === undefined,
  );
  const queryError = pageQueries.find((query) => query.error)?.error;
  const sessionExpired = queryError instanceof ApiError && queryError.status === 401;
  const retryPage = () => {
    pageQueries.forEach((query) => {
      void query.refetch();
    });
  };
  const connectionsLoading = queries.some((query) => query.isPending);
  const connectionsError = queries.find((query) => query.error)?.error;
  const match = (title: string, extra = "") =>
    (title + " " + extra).toLowerCase().includes(search.toLowerCase().trim());
  const goalList = activeGoals.filter(
    (item) => match(item.title) && (filter === "all" || filter === item.status),
  );
  const projectList = activeProjects.filter(
    (item) =>
      match(item.title, item.description ?? "") &&
      (filter === "all" || filter === item.status),
  );
  const noteList = notes.filter((item) =>
    match(item.title, notePreview(item.content)),
  );
  const stickyList = stickies.filter((item) => match(item.content));
  const libraryList = library.filter(
    (item) =>
      match(item.title, item.description ?? "") &&
      (filter === "all" || item.type_id === filter),
  );
  const timelineList = timeline.filter((item) =>
    match(item.title, item.description ?? ""),
  );
  const archive = [
    ...goals
      .filter((item) => item.is_archived)
      .map((item) => ({
        item,
        type: "goal" as const,
        date: item.archived_at ?? item.completed_at!,
      })),
    ...projects
      .filter((item) => item.is_archived)
      .map((item) => ({
        item,
        type: "project" as const,
        date: item.archived_at ?? item.completed_at!,
      })),
    ...archiveNotes.map((item) => ({
      item,
      type: "note" as const,
      date: item.archived_at!,
    })),
    ...archiveStickies.map((item) => ({
      item,
      type: "sticky_note" as const,
      date: item.archived_at!,
    })),
  ]
    .filter(
      (entry) =>
        match("title" in entry.item ? entry.item.title : entry.item.content) &&
        (filter === "all" || entry.type === filter),
    )
    .sort((a, b) => b.date.localeCompare(a.date));
  const totalArchiveCount =
    goals.filter((item) => item.is_archived).length +
    projects.filter((item) => item.is_archived).length +
    archiveNotes.length +
    archiveStickies.length;
  const entryCount = {
    today:
      activeGoals.length +
      activeProjects.length +
      notes.length +
      stickies.length +
      library.length +
      timeline.length,
    goals: activeGoals.length,
    projects: activeProjects.length,
    notes: notes.length,
    library: library.length,
    timeline: timeline.length,
    archive: totalArchiveCount,
  }[view];
  const showSearch = entryCount >= 6 || searchOpen || !!search;
  const filterOptions =
    view === "goals"
      ? [
          ["all", "All statuses"],
          ["active", "Active"],
          ["completed", "Completed"],
        ]
      : view === "projects"
        ? [
            ["all", "All statuses"],
            ["active", "Active"],
            ["paused", "Paused"],
            ["completed", "Completed"],
            ["abandoned", "Abandoned"],
          ]
        : view === "archive"
          ? [
              ["all", "All types"],
              ["goal", "Goals"],
              ["project", "Projects"],
              ["note", "Notes"],
              ["sticky_note", "Sticky notes"],
            ]
          : view === "library"
            ? [
                ["all", "All types"],
                ...types.map((type) => [type.id, type.name]),
              ]
            : [];
  const showFilter =
    filterOptions.length > 0 && (entryCount > 1 || filter !== "all");
  const add = (type: EntityType) => {
    mutation.reset();
    setModal({ kind: "edit", type });
  };
  const edit = (type: EntityType, item: EditableEntity) => {
    mutation.reset();
    setModal({ kind: "edit", type, item });
  };
  const connect = (
    type: EntityType,
    item: { id: string; title?: string; content?: unknown },
  ) =>
    setModal({
      kind: "links",
      source: {
        type,
        id: item.id,
        title:
          item.title ??
          (typeof item.content === "string"
            ? item.content.slice(0, 80)
            : "Page"),
      },
    });
  const run = (action: () => Promise<unknown>, message: string) =>
    mutation.mutate({ action, message });
  async function logout() {
    await cache.cancelQueries();
    cache.clear();
    await signOut();
    router.replace("/login");
  }
  async function finishOnboarding() {
    if (onboardingBusy) return;
    setOnboardingBusy(true);
    setOnboardingError("");
    try {
      await apiClient("/api/v1/auth/complete-onboarding", { method: "POST" });
      await refreshProfile();
      setModal(null);
    } catch (error) {
      setOnboardingError(
        error instanceof Error ? error.message : "Please try again.",
      );
    } finally {
      setOnboardingBusy(false);
    }
  }
  function controls(type: EntityType, item: EditableEntity) {
    return (
      <div className="entry-controls">
        <button
          className="icon-button"
          aria-label={`Connect ${"title" in item ? item.title : "sticky note"}`}
          onClick={() => connect(type, item)}
        >
          <Link2 size={14} />
        </button>
      </div>
    );
  }
  function goalRow(goal: Goal, full = false) {
    return (
      <div className="entity-row" key={goal.id}>
        <div className="entity-title-row">
          <button
            className={`entity-title ${goal.status === "completed" ? "completed-title" : ""}`}
            aria-label={`Edit ${goal.title}`}
            onClick={() => edit("goal", goal)}
          >
            {goal.title}
          </button>
          {controls("goal", goal)}
        </div>
        {goal.progress_percent !== null && goal.status === "active" && (
          <div className="goal-measure">
            <div
              className="progress-track"
              role="progressbar"
              aria-label={`Progress for ${goal.title}`}
              aria-valuenow={goal.progress_percent}
              aria-valuemin={0}
              aria-valuemax={100}
            >
              <div
                className="progress-ink"
                style={{ width: `${goal.progress_percent}%` }}
              />
            </div>
            <span>{goal.progress_percent}%</span>
          </div>
        )}
        {goal.in_grace_period && (
          <p className="entry-archive-date">
            Archives{" "}
            {shortDate(
              new Date(
                new Date(goal.completed_at!).getTime() + 172800000,
              ).toISOString(),
            )}
          </p>
        )}
        {full && (
          <>
            <LinkedChips
              source={{ type: "goal", id: goal.id, title: goal.title }}
              links={links}
              entities={entities}
            />
            <div className="entity-actions">
              <button
                disabled={mutation.isPending}
                className="ink-button ghost small"
                onClick={() =>
                  run(
                    () =>
                      updateGoal(goal.id, {
                        status:
                          goal.status === "active" ? "completed" : "active",
                      }),
                    goal.status === "active"
                      ? "Goal completed."
                      : "Goal reopened.",
                  )
                }
              >
                {goal.status === "active" ? (
                  <>
                    <Check size={13} />
                    Complete
                  </>
                ) : (
                  <>↶ Reopen</>
                )}
              </button>
            </div>
          </>
        )}
      </div>
    );
  }
  function projectRow(project: Project, full = false) {
    return (
      <div className="entity-row" key={project.id}>
        <div className="entity-title-row">
          <button
            className={`entity-title ${project.status === "completed" || project.status === "abandoned" ? "completed-title" : ""}`}
            aria-label={`Edit ${project.title}`}
            onClick={() => edit("project", project)}
          >
            {project.title}
          </button>
          <div className="project-state">
            {full ? (
              <select
                aria-label={`Status for ${project.title}`}
                value={project.status}
                disabled={mutation.isPending}
                onChange={(event) => {
                  const status = event.target.value as ProjectStatus;
                  run(
                    () => updateProject(project.id, { status }),
                    "Project updated.",
                  );
                }}
              >
                <option value="active">Active</option>
                <option value="paused">Paused</option>
                <option value="completed">Completed</option>
                <option value="abandoned">Abandoned</option>
              </select>
            ) : (
              <span>{project.status}</span>
            )}
            {controls("project", project)}
          </div>
        </div>
        {project.description && full && (
          <p className="entity-description">{project.description}</p>
        )}
        {project.in_grace_period && (
          <p className="entry-archive-date">
            Archives{" "}
            {shortDate(
              new Date(
                new Date(project.completed_at!).getTime() + 172800000,
              ).toISOString(),
            )}
          </p>
        )}
        {full && (
          <LinkedChips
            source={{ type: "project", id: project.id, title: project.title }}
            links={links}
            entities={entities}
          />
        )}
      </div>
    );
  }
  function noteCard(note: Note) {
    return (
      <Paper key={note.id} className="note-card">
        <button className="text-left w-full" onClick={() => edit("note", note)}>
          <h3>{note.title}</h3>
          <p className="note-excerpt">
            {notePreview(note.content) || "Empty note"}
          </p>
        </button>
        <LinkedChips
          source={{ type: "note", id: note.id, title: note.title }}
          links={links}
          entities={entities}
        />
        <div className="note-card-footer">
          <span>{shortDate(note.updated_at)}</span>
          <div className="flex">
            <button
              className="icon-button"
              aria-label={`Connect ${note.title}`}
              onClick={() => connect("note", note)}
            >
              <Link2 size={13} />
            </button>
            <button
              className="icon-button"
              disabled={mutation.isPending}
              aria-label={`Archive ${note.title}`}
              onClick={() =>
                run(
                  () => workspaceApi.archive("notes", note.id),
                  "Note archived.",
                )
              }
            >
              <Archive size={13} />
            </button>
          </div>
        </div>
      </Paper>
    );
  }
  function stickyCard(sticky: StickyNote) {
    return (
      <Paper
        key={sticky.id}
        tone={sticky.color_token ?? "yellow"}
        className="sticky-card"
      >
        <button
          className="sticky-content w-full text-left"
          onClick={() => edit("sticky_note", sticky)}
        >
          {sticky.content}
        </button>
        <div className="sticky-footer">
          <span className="record">{shortDate(sticky.created_at)}</span>
          <button
            className="icon-button"
            aria-label="Connect sticky note"
            onClick={() => connect("sticky_note", sticky)}
          >
            <Link2 size={12} />
          </button>
          <button
            className="icon-button"
            disabled={mutation.isPending}
            aria-label="Turn sticky note into a full note"
            onClick={() =>
              run(() => workspaceApi.promote(sticky.id), "Saved as a Note.")
            }
          >
            <FileText size={12} />
          </button>
          <button
            className="icon-button"
            disabled={mutation.isPending}
            aria-label="Archive sticky note"
            onClick={() =>
              run(
                () => workspaceApi.archive("sticky-notes", sticky.id),
                "Sticky note archived.",
              )
            }
          >
            <Archive size={12} />
          </button>
        </div>
      </Paper>
    );
  }
  function libraryCard(item: LibraryItem) {
    const kind = types.find((type) => type.id === item.type_id);
    return (
      <Paper key={item.id} className="note-card">
        <div className="flex justify-between items-start">
          <div className="library-type-icon">
            <BookOpen size={19} strokeWidth={1.2} />
          </div>
          {controls("library_item", item)}
        </div>
        <span className="stamp book">{kind?.name ?? "Library"}</span>
        <button
          className="w-full text-left"
          onClick={() => edit("library_item", item)}
        >
          <h3>{item.title}</h3>
        </button>
        {item.description && <p className="note-excerpt">{item.description}</p>}
        {item.url && (
          <a
            className="library-url"
            href={item.url}
            target="_blank"
            rel="noopener noreferrer"
          >
            Open reference <ArrowUpRight size={12} />
          </a>
        )}
        <LinkedChips
          source={{ type: "library_item", id: item.id, title: item.title }}
          links={links}
          entities={entities}
        />
        <div className="note-card-footer">
          <span>Added {shortDate(item.created_at)}</span>
        </div>
      </Paper>
    );
  }
  const createForView: Partial<Record<View, EntityType>> = {
    goals: "goal",
    projects: "project",
    notes: "note",
    library: "library_item",
    timeline: "timeline_entry",
  };
  if (!authLoading && !user && sessionError)
    return (
      <main className="auth-shell">
        <div className="auth-content">
          <NotebookLogo />
          <p className="error-note mt-6" role="alert">
            {sessionError}
          </p>
          <div className="form-actions">
            <button className="ink-button" onClick={retrySession}>
              Try again
            </button>
            <button className="ink-button ghost" onClick={logout}>
              Sign out
            </button>
          </div>
        </div>
      </main>
    );
  if (authLoading || !user)
    return (
      <div className="auth-shell">
        <div className="text-center">
          <NotebookLogo />
          <p className="handwriting mt-6 text-2xl text-muted-foreground">
            Opening your notebook…
          </p>
        </div>
      </div>
    );
  return (
    <div className="notebook-layout">
      <a
        href="#notebook-page"
        className="sr-only focus:not-sr-only fixed left-4 top-4 z-50 ink-button"
      >
        Skip to your notebook
      </a>
      <aside className="notebook-sidebar">
        <NotebookLogo />
        <nav className="notebook-nav" aria-label="Notebook sections">
          {pages.map((page, index) => (
            <Link
              key={page.view}
              href={`/dashboard?view=${page.view}`}
              className={view === page.view ? "active" : ""}
              aria-current={view === page.view ? "page" : undefined}
            >
              <span className="index-number">
                {String(index + 1).padStart(2, "0")}
              </span>
              {page.label}
            </Link>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="sidebar-account">
            <span className="account-name">{user.email}</span>
            <button
              className="icon-button"
              aria-label="Sign out"
              onClick={logout}
            >
              <LogOut size={15} />
            </button>
          </div>
        </div>
      </aside>
      <div className="notebook-main">
        <main id="notebook-page" className="notebook-canvas">
          <header className="folio-heading">
            <div className="folio-title">
              <div>
                <h1 id="notebook-heading" tabIndex={-1}>
                  {pages.find((page) => page.view === view)?.label}
                </h1>
                {view === "today" && (
                  <p className="folio-date">
                    {new Date().toLocaleDateString(undefined, {
                      weekday: "long",
                      month: "long",
                      day: "numeric",
                    })}
                  </p>
                )}
                {sectionDescriptions[view] && entryCount === 0 && (
                  <p className="folio-date">{sectionDescriptions[view]}</p>
                )}
              </div>
              {entryCount > 0 && view !== "today" && (
                <span className="entry-count">
                  {entryCount} {entryCount === 1 ? "entry" : "entries"}
                </span>
              )}
            </div>
            <div className="folio-actions">
              {entryCount > 0 && !showSearch && (
                <button
                  className="icon-button"
                  aria-label="Open search"
                  aria-keyshortcuts="Control+k Meta+k"
                  title="Search (Ctrl or ⌘ K)"
                  onClick={() => setSearchOpen(true)}
                >
                  <Search size={15} />
                </button>
              )}
              {createForView[view] && (
                <button
                  className="ink-button"
                  onClick={() => add(createForView[view]!)}
                >
                  <Plus size={14} /> New{" "}
                  {typeNames[createForView[view]!].toLowerCase()}
                </button>
              )}
              {view === "today" && (
                <button
                  className="ink-button"
                  onClick={() => setModal({ kind: "quick" })}
                >
                  <Plus size={14} /> Add
                </button>
              )}
              <button
                className="icon-button mobile-signout"
                aria-label="Sign out"
                onClick={logout}
              >
                <LogOut size={15} />
              </button>
            </div>
          </header>
          {(showSearch || showFilter) && (
            <div className="workspace-toolbar">
              {showSearch && (
                <div className="search-box">
                  <Search size={14} />
                  <input
                    ref={searchInput}
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Search"
                    aria-label="Search your notebook"
                    aria-keyshortcuts="Control+k Meta+k"
                    onKeyDown={(event) => {
                      if (event.key === "Escape") {
                        event.stopPropagation();
                        setSearch("");
                        setSearchOpen(false);
                        document.getElementById("notebook-heading")?.focus();
                      }
                    }}
                  />
                  {search && (
                    <button
                      className="icon-button"
                      aria-label="Clear search"
                      onClick={() => setSearch("")}
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>
              )}
              {showFilter && (
                <select
                  className="page-filter"
                  aria-label={
                    view === "library" || view === "archive"
                      ? "Filter by type"
                      : "Filter by status"
                  }
                  value={filter}
                  onChange={(event) => setFilter(event.target.value)}
                >
                  {filterOptions.map(([value, label]) => (
                    <option value={value} key={value}>
                      {label}
                    </option>
                  ))}
                </select>
              )}
            </div>
          )}
          {mutation.error && (
            <div role="alert" className="error-note">
              {mutation.error.message}
              <button
                className="ml-3 underline"
                onClick={() => mutation.reset()}
              >
                Dismiss
              </button>
            </div>
          )}
          {queryError && (
            <div role="alert" className="error-note">
              {sessionExpired
                ? "Your session has expired. Sign in again to continue."
                : pageUnavailable
                  ? "This section couldn’t load. Your entries haven’t been removed."
                  : "Couldn’t refresh this section. Showing the last loaded entries."}
              <button
                className="ml-3 underline"
                disabled={!sessionExpired && pageQueries.some((query) => query.isFetching)}
                onClick={sessionExpired ? logout : retryPage}
              >
                {sessionExpired ? "Sign in again" : "Try again"}
              </button>
            </div>
          )}
          {pageUnavailable ? null : loading ? (
            <p className="form-hint" role="status" aria-label="Loading notebook">
              {pageQueries.some((query) => query.isPaused)
                ? "Waiting for a connection…"
                : "Loading entries…"}
            </p>
          ) : (
            <div key={view} className="page-animation">
              {view === "today" && !search && (
                <div className="daily-page">
                  {entryCount === 0 && (
                    <div className="first-entry">
                      <p>This notebook is empty.</p>
                      <span>
                        Add a goal, project, note, or something you want to
                        keep.
                      </span>
                    </div>
                  )}
                  <section className="thought-area" aria-label="Sticky notes">
                    <div className="daily-section-heading">
                      <h2>Loose notes</h2>
                      {stickyList.length > 0 && (
                        <button
                          className="text-add"
                          onClick={() => add("sticky_note")}
                        >
                          <Plus size={13} /> Sticky note
                        </button>
                      )}
                    </div>
                    {stickyList.length > 0 ? (
                      <div className="sticky-board">
                        {stickyList.map(stickyCard)}
                      </div>
                    ) : (
                      <button
                        className="blank-sticky"
                        aria-label="New sticky note"
                        onClick={() => add("sticky_note")}
                      >
                        <span>+ Write a thought</span>
                      </button>
                    )}
                  </section>
                  {(goalList.length > 0 ||
                    projectList.length > 0 ||
                    noteList.length > 0 ||
                    libraryList.length > 0 ||
                    timelineList.length > 0) && (
                    <div className="daily-entries">
                      {goalList.length > 0 && (
                        <Section title="Goals" icon={Flag} view="goals">
                          {goalList.slice(0, 4).map((item) => goalRow(item))}
                        </Section>
                      )}
                      {projectList.length > 0 && (
                        <Section
                          title="Projects"
                          icon={FolderOpen}
                          view="projects"
                        >
                          {projectList
                            .slice(0, 4)
                            .map((item) => projectRow(item))}
                        </Section>
                      )}
                      {noteList.length > 0 && (
                        <Section title="Notes" icon={FileText} view="notes">
                          {noteList.slice(0, 3).map((note) => (
                            <div className="entity-row" key={note.id}>
                              <button
                                className="entity-title"
                                onClick={() => edit("note", note)}
                              >
                                {note.title}
                              </button>
                              <p className="note-excerpt !min-h-0 !line-clamp-2 mt-2">
                                {notePreview(note.content)}
                              </p>
                            </div>
                          ))}
                        </Section>
                      )}
                      {libraryList.length > 0 && (
                        <Section title="Library" icon={BookOpen} view="library">
                          {libraryList.slice(0, 3).map((item) => (
                            <div className="entity-row" key={item.id}>
                              <button
                                className="entity-title"
                                onClick={() => edit("library_item", item)}
                              >
                                {item.title}
                              </button>
                              <span className="library-kind">
                                {
                                  types.find((type) => type.id === item.type_id)
                                    ?.name
                                }
                              </span>
                            </div>
                          ))}
                        </Section>
                      )}
                      {timelineList.length > 0 && (
                        <Section title="Timeline" icon={Clock3} view="timeline">
                          <p className="timeline-date">
                            {shortDate(timelineList[0].event_date)}
                          </p>
                          <p className="entity-title">
                            {timelineList[0].title}
                          </p>
                        </Section>
                      )}
                    </div>
                  )}
                </div>
              )}
              {view === "today" && search && (
                <>
                  <p className="form-hint mb-5">Pages matching “{search}”</p>
                  <div className="section-grid">
                    {goalList.map((goal) => (
                      <Section key={goal.id} title="Goal" icon={Flag}>
                        {goalRow(goal, true)}
                      </Section>
                    ))}
                    {projectList.map((project) => (
                      <Section
                        key={project.id}
                        title="Project"
                        icon={FolderOpen}
                      >
                        {projectRow(project, true)}
                      </Section>
                    ))}
                    {noteList.map(noteCard)}
                    {libraryList.map(libraryCard)}
                    {stickyList.map(stickyCard)}
                    {timelineList.map((entry) => (
                      <Section key={entry.id} title="Timeline" icon={Clock3}>
                        <button
                          className="entity-title"
                          onClick={() => edit("timeline_entry", entry)}
                        >
                          {entry.title}
                        </button>
                      </Section>
                    ))}
                  </div>
                  {!goalList.length &&
                    !projectList.length &&
                    !noteList.length &&
                    !libraryList.length &&
                    !stickyList.length &&
                    !timelineList.length && (
                      <Empty
                        icon={Search}
                        title="No pages found."
                        description="Try a different word, or clear your search to see everything."
                      />
                    )}
                </>
              )}
              {view === "goals" && (
                <div className="entry-ledger">
                  {goalList.map((goal, index) => (
                    <article className="ledger-entry" key={goal.id}>
                      <span className="ledger-number">
                        {String(index + 1).padStart(2, "0")}
                      </span>
                      {goalRow(goal, true)}
                    </article>
                  ))}
                  {goalList.length === 0 && (
                    <Empty
                      icon={Flag}
                      title={
                        search || filter !== "all"
                          ? "No matching goals."
                          : "No goals yet."
                      }
                      description={
                        search || filter !== "all"
                          ? "Try a different search or status."
                          : "Use New goal to add one."
                      }
                    />
                  )}
                </div>
              )}
              {view === "projects" && (
                <div className="entry-ledger">
                  {projectList.map((project, index) => (
                    <article className="ledger-entry" key={project.id}>
                      <span className="ledger-number">
                        {String(index + 1).padStart(2, "0")}
                      </span>
                      {projectRow(project, true)}
                    </article>
                  ))}
                  {projectList.length === 0 && (
                    <Empty
                      icon={FolderOpen}
                      title={
                        search || filter !== "all"
                          ? "No matching projects."
                          : "No projects yet."
                      }
                      description={
                        search || filter !== "all"
                          ? "Try a different search or status."
                          : "Use New project to add one."
                      }
                    />
                  )}
                </div>
              )}
              {view === "notes" && (
                <div className="section-grid">
                  {noteList.map(noteCard)}
                  {noteList.length === 0 && (
                    <Empty
                      icon={FileText}
                      title={search ? "No matching notes." : "No notes yet."}
                      description={search
                        ? "Try a different word or clear your search."
                        : "Use New note to start a page."}
                    />
                  )}
                </div>
              )}
              {view === "library" && (
                <div className="section-grid">
                  {libraryList.map(libraryCard)}
                  {libraryList.length === 0 && (
                    <Empty
                      icon={BookOpen}
                      title={
                        search || filter !== "all"
                          ? "No matching items."
                          : "Your Library is empty."
                      }
                      description={search || filter !== "all"
                        ? "Try a different search or type."
                        : "Use New library item to save a reference."}
                    />
                  )}
                </div>
              )}
              {view === "timeline" && (
                <div className="max-w-3xl">
                  {timelineList.length === 0 ? (
                    <Empty
                      icon={Clock3}
                      title={search ? "No matching entries." : "No moments recorded."}
                      description={search
                        ? "Try a different word or clear your search."
                        : "Use New timeline entry to add a date and a title."}
                    />
                  ) : (
                    <div className="timeline-feed">
                      {timelineList.map((entry, index) => (
                        <div key={entry.id}>
                          {(index === 0 ||
                            timelineList[index - 1].event_date.slice(0, 4) !==
                              entry.event_date.slice(0, 4)) && (
                            <h2 className="timeline-year">
                              {entry.event_date.slice(0, 4)}
                            </h2>
                          )}
                          <div className="timeline-entry">
                            <Paper>
                              <div className="timeline-date">
                                {new Date(
                                  entry.event_date + "T12:00:00",
                                ).toLocaleDateString(undefined, {
                                  month: "long",
                                  day: "numeric",
                                })}
                              </div>
                              <div className="entity-title-row">
                                <h3 className="entity-title">{entry.title}</h3>
                                {controls("timeline_entry", entry)}
                              </div>
                              {entry.description && (
                                <p className="entity-description">
                                  {entry.description}
                                </p>
                              )}
                              <LinkedChips
                                source={{
                                  type: "timeline_entry",
                                  id: entry.id,
                                  title: entry.title,
                                }}
                                links={links}
                                entities={entities}
                              />
                              <button
                                className="ink-button ghost small mt-3"
                                onClick={() => edit("timeline_entry", entry)}
                                aria-label={`Edit ${entry.title}`}
                              >
                                <Pencil size={12} /> Edit
                              </button>
                            </Paper>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
              {view === "archive" && (
                <>
                  <div className="section-grid">
                    {archive.map(({ item, type, date }) => (
                      <Paper
                        key={`${type}:${item.id}`}
                        className="archive-card"
                      >
                        <span className="stamp">{typeNames[type]}</span>
                        <h3 className="entity-title mt-4">
                          {"title" in item ? item.title : item.content}
                        </h3>
                        {"description" in item && item.description && (
                          <p className="entity-description">
                            {item.description}
                          </p>
                        )}
                        {"status" in item && (
                          <div className="entity-meta">{item.status}</div>
                        )}
                        {type === "note" && (
                          <>
                            <p className="note-excerpt mt-3">
                              {notePreview((item as Note).content)}
                            </p>
                            <button
                              className="ink-button ghost small mt-3"
                              onClick={() =>
                                setModal({
                                  kind: "read",
                                  title: (item as Note).title,
                                  content: (item as Note).content,
                                })
                              }
                            >
                              Read this page <ArrowUpRight size={12} />
                            </button>
                          </>
                        )}
                        <LinkedChips
                          source={{
                            type,
                            id: item.id,
                            title: "title" in item ? item.title : item.content,
                          }}
                          links={links}
                          entities={entities}
                        />
                        <div className="note-card-footer">
                          Tucked away {shortDate(date)}
                        </div>
                      </Paper>
                    ))}
                    {archive.length === 0 && (
                      <Empty
                        icon={Archive}
                        title={search || filter !== "all"
                          ? "No matching archived entries."
                          : "Nothing archived."}
                        description={search || filter !== "all"
                          ? "Try a different search or type."
                          : "Archived items will appear here."}
                      />
                    )}
                  </div>
                </>
              )}
            </div>
          )}
        </main>
      </div>
      {toast && (
        <div role="status" className="toast">
          <CheckCircle2 size={15} />
          {toast}
          <button
            aria-label="Dismiss notification"
            onClick={() => setToast("")}
          >
            <X size={13} />
          </button>
        </div>
      )}
      {modal?.kind === "edit" && (
        <EntityEditor
          key={`${modal.type}:${modal.item?.id ?? "new"}`}
          kind={modal.type}
          item={modal.item}
          types={types}
          onTypesChanged={() => {
            void cache.invalidateQueries({ queryKey: [...queryKey, "types"] });
          }}
          onClose={() => setModal(null)}
          onSaved={(message) => {
            setModal(null);
            cache.invalidateQueries({ queryKey });
            setToast(message);
          }}
        />
      )}
      {modal?.kind === "links" && (
        <Connections
          source={modal.source}
          links={links}
          entities={entities}
          loading={connectionsLoading}
          loadError={connectionsError?.message}
          onRetry={() => {
            queries.forEach((query) => {
              void query.refetch();
            });
          }}
          onClose={() => setModal(null)}
          onChanged={() => cache.invalidateQueries({ queryKey })}
        />
      )}
      {modal?.kind === "read" && (
        <NotebookDialog title={modal.title} wide onClose={() => setModal(null)}>
          <p className="form-hint">A saved page from your Archive.</p>
          {modal.content && (
            <NoteEditor content={modal.content} readOnly onChange={() => {}} />
          )}
        </NotebookDialog>
      )}
      {modal?.kind === "quick" && (
        <NotebookDialog title="Add to notebook" onClose={() => setModal(null)}>
          <div className="quick-add-grid">
            {(Object.keys(typeNames) as EntityType[]).map((type) => {
              const Icon = icons[type];
              return (
                <button
                  className="quick-add-choice"
                  key={type}
                  onClick={() => add(type)}
                >
                  <Icon size={21} strokeWidth={1.3} />
                  <span>{typeNames[type]}</span>
                </button>
              );
            })}
          </div>
        </NotebookDialog>
      )}
      {modal?.kind === "onboard" && (
        <NotebookDialog
          title={
            [
              "Your notebook",
              "Notes and sticky notes",
              "Connections and Archive",
            ][step]
          }
          onClose={finishOnboarding}
          closeDisabled={onboardingBusy}
        >
          <p className="entity-description">
            {
              [
                "Today holds your sticky notes and an overview of your work. Use Add to create something, or choose a section from the notebook index.",
                "Sticky notes live on Today. When a thought needs more room, turn it into a Note. Write and reorder your blocks, then save when you’re ready.",
                "Use the link icon to connect entries. Library keeps outside references; Timeline holds dates you choose to record. Completed goals and completed or abandoned projects move to Archive after two days. Notes and sticky notes are archived manually.",
              ][step]
            }
          </p>
          {onboardingError && (
            <p className="error-note" role="alert">
              {onboardingError}
            </p>
          )}
          <div className="form-actions">
            <span className="form-hint mr-auto">{step + 1} / 3</span>
            <button
              className="ink-button ghost"
              disabled={onboardingBusy}
              onClick={finishOnboarding}
            >
              Skip tour
            </button>
            <button
              className="ink-button"
              disabled={onboardingBusy}
              onClick={() =>
                step < 2 ? setStep(step + 1) : finishOnboarding()
              }
            >
              {onboardingBusy ? "Opening…" : step < 2 ? "Next" : "Done"}
              <ArrowRight size={14} />
            </button>
          </div>
        </NotebookDialog>
      )}
    </div>
  );
}

export default function NotebookApp() {
  return (
    <Suspense
      fallback={
        <div className="auth-shell">
          <p className="handwriting text-2xl">Opening your notebook…</p>
        </div>
      }
    >
      <NotebookWorkspace />
    </Suspense>
  );
}
