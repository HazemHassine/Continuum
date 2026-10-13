"use client";

import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getProjects, createProject, updateProject, reopenProject } from "@/lib/goals-projects";
import { Project, ProjectStatus } from "@/types/domain";
import { useAuth } from "@/context/auth-context";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  FolderKanban,
  Plus,
  Play,
  Pause,
  CheckCircle2,
  XCircle,
  RotateCcw,
  Clock,
} from "lucide-react";

export function ProjectsSection({ archived = false }: { archived?: boolean }) {
  const { user } = useAuth();
  const [editingId, setEditingId] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const [isCreating, setIsCreating] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDescription, setNewDescription] = useState("");

  const { data: projects = [], isLoading, error } = useQuery<Project[]>({
    queryKey: ["projects", user?.id, archived],
    queryFn: () => getProjects(archived ? "archived" : "active_workspace"),
    enabled: !!user,
    refetchInterval: 30_000,
  });

  const createMutation = useMutation({
    mutationFn: () =>
      (editingId ? updateProject.bind(null, editingId) : createProject)({
        title: newTitle,
        description: newDescription || null,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      setNewTitle("");
      setNewDescription("");
      setIsCreating(false);
      setEditingId(null);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: ProjectStatus }) =>
      updateProject(id, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projects"] });
    },
  });

  const reopenMutation = useMutation({
    mutationFn: (id: string) => reopenProject(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projects"] });
    },
  });

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;
    createMutation.mutate();
  };

  const getStatusBadge = (status: ProjectStatus) => {
    switch (status) {
      case "active":
        return <Badge variant="default" className="text-[10px] py-0">Active</Badge>;
      case "paused":
        return <Badge variant="warning" className="text-[10px] py-0">Paused</Badge>;
      case "completed":
        return <Badge variant="success" className="text-[10px] py-0">Completed</Badge>;
      case "abandoned":
        return <Badge variant="destructive" className="text-[10px] py-0">Abandoned</Badge>;
    }
  };

  return (
    <Card className="border border-border/80">
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <div className="flex items-center gap-2">
          <FolderKanban className="h-5 w-5 text-primary" />
          <CardTitle className="text-lg">Projects</CardTitle>
          <span className="text-xs text-muted-foreground font-mono">
            ({projects.length})
          </span>
        </div>
        {!archived && <Button
          size="sm"
          variant="outline"
          disabled={createMutation.isPending}
          onClick={() => { setEditingId(null); setNewTitle(""); setNewDescription(""); setIsCreating(!isCreating); createMutation.reset(); }}
          className="gap-1 text-xs"
        >
          <Plus className="h-3.5 w-3.5" />
          {isCreating ? "Cancel" : "New Project"}
        </Button>}
      </CardHeader>

      <CardContent className="space-y-4">
        {(createMutation.error || updateMutation.error || reopenMutation.error) && <p role="alert" className="text-sm text-destructive">{(createMutation.error || updateMutation.error || reopenMutation.error)?.message}</p>}
        {isCreating && (
          <form
            onSubmit={handleCreate}
            className="rounded-lg border bg-muted/40 p-3 space-y-3"
          >
            <div className="space-y-1">
              <label htmlFor={`project-title-${archived}`} className="text-xs font-medium">Project Title</label>
              <Input
                id={`project-title-${archived}`}
                required
                placeholder="e.g. Redesign portfolio website"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                autoFocus
              />
            </div>
            <div className="space-y-1">
              <label htmlFor={`project-description-${archived}`} className="text-xs font-medium">Optional Description</label>
              <Input
                id={`project-description-${archived}`}
                placeholder="Scope, key references, or purpose"
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={createMutation.isPending}
                onClick={() => setIsCreating(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={!newTitle.trim() || createMutation.isPending}
              >
                {createMutation.isPending ? "Creating..." : "Save Project"}
              </Button>
            </div>
          </form>
        )}

        {isLoading ? (
          <div className="text-xs text-muted-foreground py-4 text-center animate-pulse">
            Loading projects...
          </div>
        ) : error ? (
          <div className="text-xs text-destructive py-2">
            Failed to load projects: {String(error)}
          </div>
        ) : projects.length === 0 ? (
          <div className="rounded-lg border border-dashed py-8 text-center text-xs text-muted-foreground">
            No {archived ? "archived" : "current"} projects.
          </div>
        ) : (
          <div className="grid gap-3">
            {projects.map((project) => {
              const isTerminal =
                project.status === "completed" || project.status === "abandoned";
              const inGrace = project.in_grace_period;

              return (
                <div
                  key={project.id}
                  className={`flex flex-col justify-between p-3.5 rounded-lg border transition-all ${
                    isTerminal
                      ? "bg-muted/20 border-muted opacity-85"
                      : "bg-card hover:border-primary/40 shadow-sm"
                  }`}
                >
                  <div className="space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <h4
                        className={`text-sm font-semibold leading-tight ${
                          isTerminal ? "text-muted-foreground line-through" : ""
                        }`}
                      >
                        {project.title}
                      </h4>
                      <div className="flex items-center gap-1 shrink-0">
                        {getStatusBadge(project.status)}
                        {inGrace && (
                          <Badge
                            variant="warning"
                            className="gap-0.5 text-[9px] px-1 py-0"
                            title={`Archives ${new Date(new Date(project.completed_at!).getTime() + 172800000).toLocaleString()} unless reopened`}
                          >
                            <Clock className="h-2.5 w-2.5" /> 2d grace
                          </Badge>
                        )}
                      </div>
                    </div>

                    {project.description && (
                      <p className="text-xs text-muted-foreground line-clamp-2">
                        {project.description}
                      </p>
                    )}
                  </div>

                  {/* Lifecycle Controls */}
                  {!archived && <fieldset aria-label={`Actions for ${project.title}`} disabled={createMutation.isPending || updateMutation.isPending || reopenMutation.isPending} className="mt-4 pt-2 border-t flex flex-wrap items-center gap-2">
                    <Button size="sm" variant="ghost" disabled={updateMutation.isPending} onClick={() => { setEditingId(project.id); setNewTitle(project.title); setNewDescription(project.description ?? ""); setIsCreating(true); createMutation.reset(); }}>Edit</Button>
                    {project.status === "active" && (
                      <div className="flex flex-wrap items-center gap-1.5 w-full justify-between">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 px-2 text-[11px] gap-1 text-muted-foreground hover:text-foreground"
                          onClick={() =>
                            updateMutation.mutate({
                              id: project.id,
                              status: "paused",
                            })
                          }
                        >
                          <Pause className="h-3 w-3" /> Pause
                        </Button>
                        <div className="flex items-center gap-1">
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 px-2 text-[11px] gap-1 text-destructive hover:bg-destructive/10"
                            onClick={() =>
                              updateMutation.mutate({
                                id: project.id,
                                status: "abandoned",
                              })
                            }
                          >
                            <XCircle className="h-3 w-3" /> Abandon
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 px-2 text-[11px] gap-1 text-emerald-600 hover:bg-emerald-50"
                            onClick={() =>
                              updateMutation.mutate({
                                id: project.id,
                                status: "completed",
                              })
                            }
                          >
                            <CheckCircle2 className="h-3 w-3" /> Complete
                          </Button>
                        </div>
                      </div>
                    )}

                    {project.status === "paused" && (
                      <div className="flex flex-wrap items-center gap-1.5 w-full justify-between">
                        <Button size="sm" disabled={updateMutation.isPending} onClick={() => updateMutation.mutate({ id: project.id, status: "completed" })}>Complete</Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 px-2 text-[11px] gap-1"
                          onClick={() =>
                            updateMutation.mutate({
                              id: project.id,
                              status: "active",
                            })
                          }
                        >
                          <Play className="h-3 w-3" /> Resume
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 px-2 text-[11px] gap-1 text-destructive hover:bg-destructive/10"
                          onClick={() =>
                            updateMutation.mutate({
                              id: project.id,
                              status: "abandoned",
                            })
                          }
                        >
                          <XCircle className="h-3 w-3" /> Abandon
                        </Button>
                      </div>
                    )}

                    {isTerminal && inGrace && (
                      <div className="flex flex-wrap gap-2 items-center justify-end w-full">
                        <Button size="sm" variant="outline" disabled={updateMutation.isPending} onClick={() => updateMutation.mutate({ id: project.id, status: "paused" })}>Reopen (Paused)</Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 px-2 text-[11px] gap-1"
                          onClick={() => reopenMutation.mutate(project.id)}
                          disabled={reopenMutation.isPending}
                        >
                          <RotateCcw className="h-3 w-3" /> Reopen (Active)
                        </Button>
                      </div>
                    )}
                  </fieldset>}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
