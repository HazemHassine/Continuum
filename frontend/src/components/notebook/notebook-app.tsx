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
  ChevronRight,
  Clock3,
  FileText,
  Flag,
  FolderOpen,
  Home,
  Link2,
  LogOut,
  Pencil,
  Plus,
  Search,
  StickyNote as StickyIcon,
  X,
} from "lucide-react";
import { useAuth } from "@/context/auth-context";
import { apiClient } from "@/lib/api-client";
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
import { NotebookLogo, MountainSketch, Paper, Mark } from "./sketch";
import { NotebookDialog } from "./dialog";
import { EntityEditor, type EditableEntity } from "./entity-editor";
import { Connections, otherEnd } from "./connections";

const NoteEditor = dynamic(() => import("./note-editor"), { ssr: false });
const pages = [
  { view: "today", label: "Today", icon: Home },
  { view: "goals", label: "Goals", icon: Flag },
  { view: "projects", label: "Projects", icon: FolderOpen },
  { view: "notes", label: "Notes", icon: FileText },
  { view: "library", label: "Library", icon: BookOpen },
  { view: "timeline", label: "Timeline", icon: Clock3 },
  { view: "archive", label: "Archive", icon: Archive },
] as const;
const headings: Record<
  View,
  { title: string; subtitle: string; margin: string }
> = {
  today: {
    title: "A little space for your life.",
    subtitle: "What matters now, and the thoughts along the way.",
    margin: "One page at a time.",
  },
  goals: {
    title: "Things worth reaching for.",
    subtitle: "A direction, not a demand. Small steps count.",
    margin: "Enjoy the climb.",
  },
  projects: {
    title: "Ideas, becoming real.",
    subtitle: "Make room for the work you want to put into the world.",
    margin: "A little, often.",
  },
  notes: {
    title: "Leave a little ink.",
    subtitle:
      "Thinking out loud, on paper. Save the things you don’t want to lose.",
    margin: "Room to think.",
  },
  library: {
    title: "A shelf of good things.",
    subtitle: "Books, films, ideas, and things that open a window.",
    margin: "Stay curious.",
  },
  timeline: {
    title: "The story so far.",
    subtitle:
      "A few moments you chose to remember. Your history, in your words.",
    margin: "Look how far.",
  },
  archive: {
    title: "Pages you've turned.",
    subtitle: "Finished work and saved thoughts. Still part of the story.",
    margin: "Nothing is wasted.",
  },
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
  icon: Icon,
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
      <Icon size={25} strokeWidth={1.2} />
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
  icon: Icon,
  view,
  children,
  className = "",
  tone,
}: {
  title: string;
  icon: typeof Flag;
  view?: View;
  children: ReactNode;
  className?: string;
  tone?: string;
}) {
  return (
    <Paper className={className} tone={tone}>
      <div className="section-heading">
        <div className="section-title">
          <Icon />
          <h2>{title}</h2>
        </div>
        {view && (
          <Link href={`/dashboard?view=${view}`} className="view-all">
            All pages <ArrowUpRight size={12} />
          </Link>
        )}
      </div>
      {children}
    </Paper>
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
            <span>{found?.title ?? "Archived page"}</span>
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
  const { user, isLoading: authLoading, signOut, refreshProfile } = useAuth();
  const cache = useQueryClient();
  const queryKey = ["notebook", user?.id];
  const options = { enabled: !!user, refetchInterval: 30_000 };
  const goalsQuery = useQuery({
    queryKey: [...queryKey, "goals"],
    queryFn: () => getGoals("all"),
    ...options,
  });
  const projectsQuery = useQuery({
    queryKey: [...queryKey, "projects"],
    queryFn: () => getProjects("all"),
    ...options,
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
  const [filter, setFilter] = useState("all");
  const [modal, setModal] = useState<Modal | null>(null);
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
    onSuccess: (message) => {
      cache.invalidateQueries({ queryKey: ["notebook", user?.id] });
      setToast(message);
    },
  });
  useEffect(() => {
    if (!authLoading && !user) router.replace("/login");
  }, [authLoading, user, router]);
  useEffect(() => {
    if (user && !user.onboarding_completed_at && !onboardShown.current) {
      onboardShown.current = true;
      setModal({ kind: "onboard" });
    }
  }, [user]);
  useEffect(() => {
    setSearch("");
    setFilter("all");
  }, [view]);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(""), 4500);
    return () => clearTimeout(timer);
  }, [toast]);
  useEffect(() => {
    const shortcut = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key === "k") {
        event.preventDefault();
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
  const loading = queries.some((query) => query.isLoading);
  const queryError = queries.find((query) => query.error)?.error;
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
  const name = user?.email?.split("@")[0].split(/[._-]/)[0] ?? "friend";
  const displayName = name.charAt(0).toUpperCase() + name.slice(1);
  const page = headings[view];
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
      <div className="flex shrink-0">
        <button
          className="icon-button"
          aria-label={`Edit ${"title" in item ? item.title : "sticky note"}`}
          onClick={() => edit(type, item)}
        >
          <Pencil size={13} />
        </button>
        <button
          className="icon-button"
          aria-label={`Connect ${"title" in item ? item.title : "sticky note"}`}
          onClick={() => connect(type, item)}
        >
          <Link2 size={13} />
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
            onClick={() => edit("goal", goal)}
          >
            {goal.title}
          </button>
          {controls("goal", goal)}
        </div>
        {goal.progress_percent !== null && (
          <>
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
            <div className="progress-label">
              <span>
                {goal.status === "completed"
                  ? "A little victory"
                  : "Little by little"}
              </span>
              <span>{goal.progress_percent}%</span>
            </div>
          </>
        )}
        <div className="entity-meta">
          <span className={`stamp ${goal.status}`}>{goal.status}</span>
          {goal.in_grace_period && (
            <span>
              Archives{" "}
              {shortDate(
                new Date(
                  new Date(goal.completed_at!).getTime() + 172800000,
                ).toISOString(),
              )}
            </span>
          )}
        </div>
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
                      ? "A little victory. Well done."
                      : "Back on your page.",
                  )
                }
              >
                {goal.status === "active" ? (
                  <>
                    <Check size={13} /> Complete goal
                  </>
                ) : (
                  <>↶ Reopen goal</>
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
            onClick={() => edit("project", project)}
          >
            {project.title}
          </button>
          {controls("project", project)}
        </div>
        <div className="entity-meta">
          <span className={`stamp ${project.status}`}>{project.status}</span>
          {project.in_grace_period && <span>2-day grace period</span>}
        </div>
        {project.description && full && (
          <p className="entity-description">{project.description}</p>
        )}
        {full && (
          <>
            <LinkedChips
              source={{ type: "project", id: project.id, title: project.title }}
              links={links}
              entities={entities}
            />
            <div className="entity-actions">
              <label className="form-hint flex items-center gap-2">
                Status
                <select
                  className="bg-transparent border-b border-border px-1 py-1"
                  value={project.status}
                  disabled={mutation.isPending}
                  onChange={(event) =>
                    run(
                      () =>
                        updateProject(project.id, {
                          status: event.target.value as ProjectStatus,
                        }),
                      "Project updated. Find your own pace.",
                    )
                  }
                >
                  <option value="active">Active</option>
                  <option value="paused">Paused</option>
                  <option value="completed">Completed</option>
                  <option value="abandoned">Abandoned</option>
                </select>
              </label>
            </div>
          </>
        )}
      </div>
    );
  }
  function noteCard(note: Note) {
    return (
      <Paper key={note.id} className="note-card">
        <span className="eyebrow">A page of your own</span>
        <button className="text-left w-full" onClick={() => edit("note", note)}>
          <h3>{note.title}</h3>
          <p className="note-excerpt">
            {notePreview(note.content) ||
              "A title, a thought, a beginning. Open this page to keep writing."}
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
                  "Page tucked into the Archive.",
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
              run(
                () => workspaceApi.promote(sticky.id),
                "Thought promoted to a Note. Find it on your Notes page.",
              )
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
                "Thought tucked into the Archive.",
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
          <span>Kept for later</span>
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
        <p className="sidebar-caption eyebrow">Your notebook</p>
        <nav className="notebook-nav" aria-label="Notebook sections">
          {pages.map((page) => (
            <Link
              key={page.view}
              href={`/dashboard?view=${page.view}`}
              className={view === page.view ? "active" : ""}
              aria-current={view === page.view ? "page" : undefined}
            >
              <page.icon size={16} strokeWidth={1.5} />
              {page.label}
            </Link>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="sidebar-quote">
            <span className="eyebrow">A small reminder</span>
            <p className="handwriting">
              A little progress.
              <br />A little presence.
            </p>
          </div>
          <div className="sidebar-account">
            <span className="avatar">{displayName.slice(0, 1)}</span>
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
        <header className="notebook-topbar">
          <div className="breadcrumb">
            <Home size={12} />
            <span>your notebook</span>
            <ChevronRight size={12} />
            <strong>{pages.find((page) => page.view === view)?.label}</strong>
          </div>
          <div className="topbar-actions">
            <span className="private-indicator">
              <i /> Just for you
            </span>
            <button
              className="ink-button secondary small"
              onClick={() => setModal({ kind: "quick" })}
            >
              <Plus size={13} /> A new page
            </button>
            <button
              className="icon-button sm:hidden"
              aria-label="Sign out"
              onClick={logout}
            >
              <LogOut size={15} />
            </button>
          </div>
        </header>
        <main id="notebook-page" className="notebook-canvas">
          <div className="page-intro">
            <div>
              <span className="eyebrow">
                {new Date().toLocaleDateString(undefined, {
                  weekday: "long",
                  month: "long",
                  day: "numeric",
                  year: "numeric",
                })}
              </span>
              <h1>
                {view === "today" ? (
                  <>
                    A little space for <Mark>your life.</Mark>
                  </>
                ) : (
                  <Mark key={view} color="#bec9a5">
                    {page.title}
                  </Mark>
                )}
              </h1>
              <p className="intro-note">
                {view === "today"
                  ? `Welcome back, ${displayName}. ${page.subtitle}`
                  : page.subtitle}
              </p>
            </div>
            <div className="intro-doodle">
              <MountainSketch />
              <p className="handwriting">{page.margin}</p>
            </div>
          </div>
          <div className="workspace-toolbar">
            <div className="search-box">
              <Search size={15} />
              <input
                ref={searchInput}
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Find a thought, a project, a page…"
                aria-label="Search your notebook"
                onKeyDown={(event) => {
                  if (event.key === "Escape") setSearch("");
                }}
              />
              {search ? (
                <button
                  className="icon-button"
                  aria-label="Clear search"
                  onClick={() => setSearch("")}
                >
                  <X size={14} />
                </button>
              ) : (
                <kbd>⌘ K</kbd>
              )}
            </div>
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
              <span className="handwriting text-[21px] text-[#899675]">
                Make yourself at home.
              </span>
            )}
            {(view === "goals" ||
              view === "projects" ||
              view === "archive" ||
              view === "library") && (
              <div className="filter-tabs" aria-label="Filter pages">
                {(view === "goals"
                  ? [
                      ["all", "All"],
                      ["active", "Active"],
                      ["completed", "Completed"],
                    ]
                  : view === "projects"
                    ? [
                        ["all", "All"],
                        ["active", "Active"],
                        ["paused", "Paused"],
                        ["completed", "Completed"],
                        ["abandoned", "Abandoned"],
                      ]
                    : view === "archive"
                      ? [
                          ["all", "All"],
                          ["goal", "Goals"],
                          ["project", "Projects"],
                          ["note", "Notes"],
                          ["sticky_note", "Stickies"],
                        ]
                      : [
                          ["all", "All"],
                          ...types.map((type) => [type.id, type.name]),
                        ]
                ).map(([value, label]) => (
                  <button
                    key={value}
                    className={filter === value ? "active" : ""}
                    aria-pressed={filter === value}
                    onClick={() => setFilter(value)}
                  >
                    {label}
                  </button>
                ))}
              </div>
            )}
          </div>
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
              A page couldn’t load. {queryError.message}
              <button
                className="ml-3 underline"
                onClick={() => cache.invalidateQueries({ queryKey })}
              >
                Try again
              </button>
            </div>
          )}
          {loading ? (
            <div
              className="dashboard-grid"
              role="status"
              aria-label="Loading notebook"
            >
              <Paper>
                <div className="h-36 animate-pulse bg-muted/30 rounded" />
              </Paper>
              <Paper>
                <div className="h-36 animate-pulse bg-muted/30 rounded" />
              </Paper>
            </div>
          ) : (
            <div key={view} className="page-animation">
              {view === "today" && !search && (
                <div className="dashboard-grid">
                  <div className="dashboard-column">
                    <Section title="On your mind" icon={StickyIcon}>
                      <div className="sticky-board">
                        {stickyList.map(stickyCard)}
                      </div>
                      {stickyList.length === 0 && (
                        <Empty
                          icon={StickyIcon}
                          title="A thought can start anywhere."
                          description="Catch an idea, a reminder, or a sentence you want to keep. No need to organize it yet."
                          onAdd={() => add("sticky_note")}
                          action="Leave a little thought"
                        />
                      )}
                      <button
                        className="quick-note"
                        onClick={() => add("sticky_note")}
                      >
                        <Plus size={13} /> Leave a thought here…
                      </button>
                    </Section>
                    <Section
                      title="In the making"
                      icon={FolderOpen}
                      view="projects"
                    >
                      {projectList.slice(0, 4).map((item) => projectRow(item))}
                      {projectList.length === 0 && (
                        <Empty
                          icon={FolderOpen}
                          title="Room for something good."
                          description="What would you like to bring into the world?"
                          action="Start a project"
                          onAdd={() => add("project")}
                        />
                      )}
                    </Section>
                    <Section title="A few words" icon={FileText} view="notes">
                      {noteList.slice(0, 3).map((note) => (
                        <div className="entity-row" key={note.id}>
                          <button
                            className="entity-title"
                            onClick={() => edit("note", note)}
                          >
                            {note.title}
                          </button>
                          <p className="note-excerpt !min-h-0 !line-clamp-2 mt-2">
                            {notePreview(note.content) ||
                              "Your next sentence starts here."}
                          </p>
                          <div className="entity-meta">
                            {shortDate(note.updated_at)}
                          </div>
                        </div>
                      ))}
                      {noteList.length === 0 && (
                        <Empty
                          icon={FileText}
                          title="Your next sentence starts here."
                          description="A page for thinking, making sense, or simply remembering."
                          action="Open a blank page"
                          onAdd={() => add("note")}
                        />
                      )}
                    </Section>
                  </div>
                  <div className="dashboard-column">
                    <Section title="Little by little" icon={Flag} view="goals">
                      {goalList.slice(0, 4).map((item) => goalRow(item))}
                      {goalList.length === 0 && (
                        <Empty
                          icon={Flag}
                          title="Pick a direction."
                          description="Name something you want to reach for. Progress can be a percentage, or just showing up."
                          action="Write a goal"
                          onAdd={() => add("goal")}
                        />
                      )}
                    </Section>
                    <Paper tone="sage">
                      <span className="eyebrow">A note in the margin</span>
                      <p className="handwriting text-[28px] leading-tight my-3">
                        You don’t have to do it all.
                        <br />
                        Just keep a little space
                        <br />
                        for what matters.
                      </p>
                      <div className="flex justify-between items-end">
                        <MountainSketch className="!w-32" />
                        <span className="handwriting text-lg text-[#91a27b]">
                          At your own pace.
                        </span>
                      </div>
                    </Paper>
                    <Section
                      title="On the shelf"
                      icon={BookOpen}
                      view="library"
                    >
                      {libraryList.slice(0, 3).map((item) => (
                        <div className="entity-row" key={item.id}>
                          <button
                            className="entity-title"
                            onClick={() => edit("library_item", item)}
                          >
                            {item.title}
                          </button>
                          <div className="entity-meta">
                            <span className="stamp book">
                              {types.find((type) => type.id === item.type_id)
                                ?.name ?? "Reference"}
                            </span>
                            {item.url && (
                              <a
                                href={item.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="ml-auto"
                                aria-label={`Open ${item.title}`}
                              >
                                <ArrowUpRight size={13} />
                              </a>
                            )}
                          </div>
                        </div>
                      ))}
                      {libraryList.length === 0 && (
                        <Empty
                          icon={BookOpen}
                          title="Keep something that inspires you."
                          description="A book, a film, an article. A shelf for the things you find."
                          action="Add to your shelf"
                          onAdd={() => add("library_item")}
                        />
                      )}
                    </Section>
                    {timelineList.length > 0 && (
                      <Section
                        title="A moment to remember"
                        icon={Clock3}
                        view="timeline"
                      >
                        <p className="timeline-date">
                          {shortDate(timelineList[0].event_date)}
                        </p>
                        <p className="entity-title">{timelineList[0].title}</p>
                        {timelineList[0].description && (
                          <p className="entity-description">
                            {timelineList[0].description}
                          </p>
                        )}
                      </Section>
                    )}
                  </div>
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
                <div className="section-grid">
                  {goalList.map((goal) => (
                    <Paper key={goal.id}>{goalRow(goal, true)}</Paper>
                  ))}
                  {goalList.length === 0 && (
                    <Paper>
                      <Empty
                        icon={Flag}
                        title={
                          search || filter !== "all"
                            ? "No goals on this page."
                            : "A direction is a good beginning."
                        }
                        description="Start with something small, something yours."
                        action="Write a goal"
                        onAdd={() => add("goal")}
                      />
                    </Paper>
                  )}
                </div>
              )}
              {view === "projects" && (
                <div className="section-grid">
                  {projectList.map((project) => (
                    <Paper key={project.id}>{projectRow(project, true)}</Paper>
                  ))}
                  {projectList.length === 0 && (
                    <Paper>
                      <Empty
                        icon={FolderOpen}
                        title="Something good starts small."
                        description="Name the thing you'd like to make. You can figure out the rest along the way."
                        action="Start a project"
                        onAdd={() => add("project")}
                      />
                    </Paper>
                  )}
                </div>
              )}
              {view === "notes" && (
                <div className="section-grid">
                  {noteList.map(noteCard)}
                  {noteList.length === 0 && (
                    <Paper>
                      <Empty
                        icon={FileText}
                        title="A blank page is an invitation."
                        description="Write, rearrange, make a list. Save it when it feels ready."
                        action="Open a blank page"
                        onAdd={() => add("note")}
                      />
                    </Paper>
                  )}
                </div>
              )}
              {view === "library" && (
                <div className="section-grid">
                  {libraryList.map(libraryCard)}
                  {libraryList.length === 0 && (
                    <Paper>
                      <Empty
                        icon={BookOpen}
                        title="Build a shelf of your own."
                        description="For the things you discover. Reading, watching, learning, wondering."
                        action="Add a good thing"
                        onAdd={() => add("library_item")}
                      />
                    </Paper>
                  )}
                </div>
              )}
              {view === "timeline" && (
                <div className="max-w-3xl">
                  {timelineList.length === 0 ? (
                    <Paper>
                      <Empty
                        icon={Clock3}
                        title="A story, waiting for its first line."
                        description="Choose a moment worth remembering. Only you decide what goes here."
                        action="Remember a moment"
                        onAdd={() => add("timeline_entry")}
                      />
                    </Paper>
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
                  <p className="form-hint mb-6">
                    Goals and terminal projects arrive here after two days.
                    Notes and sticky notes arrive when you archive them.
                  </p>
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
                      <Paper>
                        <Empty
                          icon={Archive}
                          title="Pages you've yet to turn."
                          description="When something leaves your active notebook, you'll find it here. Kept, rather than forgotten."
                        />
                      </Paper>
                    )}
                  </div>
                </>
              )}
            </div>
          )}
          <footer className="notebook-footer">
            <div className="footer-caption">
              <MountainSketch />
              <span>Your pace. Your pages.</span>
            </div>
            <span className="handwriting">
              “A tracker for the life I want.”
            </span>
          </footer>
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
        <NotebookDialog
          title="What would you like to put on paper?"
          onClose={() => setModal(null)}
        >
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
          <p className="form-hint mt-6">
            Nothing needs a perfect place. Just begin.
          </p>
        </NotebookDialog>
      )}
      {modal?.kind === "onboard" && (
        <NotebookDialog
          title={
            [
              "Welcome to your notebook.",
              "Catch the little thoughts.",
              "Connect the dots.",
            ][step]
          }
          onClose={finishOnboarding}
        >
          <div className="mb-6">
            <MountainSketch className="!w-48 mx-auto" />
            <p className="handwriting text-[25px] text-[#7b8d65] text-center mt-3">
              {
                [
                  "A little progress. A little presence.",
                  "Ideas today. Possibilities tomorrow.",
                  "A life, not a list.",
                ][step]
              }
            </p>
          </div>
          <p className="entity-description">
            {
              [
                "Today is your home. Goals give you direction; Projects give your ideas a place to grow. Add a page with the button in the top corner.",
                "Sticky notes live on Today. When a thought needs more room, turn it into a Note. Write and reorder your blocks, then save when you’re ready.",
                "The little link icon connects any two pages. The Library keeps outside inspiration; Timeline holds moments you choose to remember. Archive keeps the pages you've turned.",
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
              {onboardingBusy
                ? "Opening…"
                : step < 2
                  ? "A little look around"
                  : "Make yourself at home"}
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
