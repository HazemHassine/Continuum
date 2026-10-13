"use client";

import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getGoals, createGoal, updateGoal, reopenGoal } from "@/lib/goals-projects";
import { Goal } from "@/types/domain";
import { useAuth } from "@/context/auth-context";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Target, Plus, CheckCircle2, RotateCcw, Clock } from "lucide-react";

export function GoalsSection({ archived = false }: { archived?: boolean }) {
  const { user } = useAuth();
  const [editingId, setEditingId] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const [isCreating, setIsCreating] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newProgress, setNewProgress] = useState<number | "">("");

  const { data: goals = [], isLoading, error } = useQuery<Goal[]>({
    queryKey: ["goals", user?.id, archived],
    queryFn: () => getGoals(archived ? "archived" : "active_workspace"),
    enabled: !!user,
    refetchInterval: 30_000,
  });

  const createMutation = useMutation({
    mutationFn: () =>
      (editingId ? updateGoal.bind(null, editingId) : createGoal)({
        title: newTitle,
        progress_percent: newProgress === "" ? null : Number(newProgress),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["goals"] });
      setNewTitle("");
      setNewProgress("");
      setIsCreating(false);
      setEditingId(null);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, progress_percent, status }: { id: string; progress_percent?: number | null; status?: "active" | "completed" }) =>
      updateGoal(id, { progress_percent, status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["goals"] });
    },
  });

  const reopenMutation = useMutation({
    mutationFn: (id: string) => reopenGoal(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["goals"] });
    },
  });

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;
    createMutation.mutate();
  };

  return (
    <Card className="border border-border/80">
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <div className="flex items-center gap-2">
          <Target className="h-5 w-5 text-primary" />
          <CardTitle className="text-lg">Goals</CardTitle>
          <span className="text-xs text-muted-foreground font-mono">
            ({goals.length})
          </span>
        </div>
        {!archived && <Button
          size="sm"
          variant="outline"
          disabled={createMutation.isPending}
          onClick={() => { setEditingId(null); setNewTitle(""); setNewProgress(""); setIsCreating(!isCreating); createMutation.reset(); }}
          className="gap-1 text-xs"
        >
          <Plus className="h-3.5 w-3.5" />
          {isCreating ? "Cancel" : "New Goal"}
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
              <label htmlFor={`goal-title-${archived}`} className="text-xs font-medium">Goal Title</label>
              <Input
                id={`goal-title-${archived}`}
                required
                placeholder="e.g. Read 12 non-fiction books this year"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                autoFocus
              />
            </div>
            <div className="space-y-1">
              <label htmlFor={`goal-progress-${archived}`} className="text-xs font-medium">Optional Progress % (0-100)</label>
              <Input
                id={`goal-progress-${archived}`}
                type="number"
                min="0"
                max="100"
                placeholder="0"
                value={newProgress}
                onChange={(e) =>
                  setNewProgress(e.target.value === "" ? "" : Number(e.target.value))
                }
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
                {createMutation.isPending ? "Creating..." : "Save Goal"}
              </Button>
            </div>
          </form>
        )}

        {isLoading ? (
          <div className="text-xs text-muted-foreground py-4 text-center animate-pulse">
            Loading goals...
          </div>
        ) : error ? (
          <div className="text-xs text-destructive py-2">
            Failed to load goals: {String(error)}
          </div>
        ) : goals.length === 0 ? (
          <div className="rounded-lg border border-dashed py-8 text-center text-xs text-muted-foreground">
            No {archived ? "archived" : "current"} goals.
          </div>
        ) : (
          <div className="space-y-2">
            {goals.map((goal) => {
              const isCompleted = goal.status === "completed";
              const inGrace = goal.in_grace_period;

              return (
                <div
                  key={goal.id}
                  className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-lg border transition-all ${
                    isCompleted
                      ? "bg-muted/30 border-muted"
                      : "bg-card hover:border-primary/40"
                  }`}
                >
                  <div className="space-y-1.5 flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className={`text-sm font-medium ${
                          isCompleted
                            ? "line-through text-muted-foreground"
                            : "text-foreground"
                        }`}
                      >
                        {goal.title}
                      </span>
                      {isCompleted ? (
                        <Badge variant="success" className="gap-1 text-[10px] py-0">
                          <CheckCircle2 className="h-3 w-3" /> Completed
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-[10px] py-0">
                          Active
                        </Badge>
                      )}
                      {inGrace && (
                        <Badge
                          variant="warning"
                          className="gap-1 text-[10px] py-0"
                          title={`Archives ${new Date(new Date(goal.completed_at!).getTime() + 172800000).toLocaleString()} unless reopened`}
                        >
                          <Clock className="h-3 w-3" /> Grace period
                        </Badge>
                      )}
                    </div>

                    {/* Progress indicator */}
                    {!isCompleted && goal.progress_percent !== null && (
                      <div className="flex items-center gap-2 pt-1 max-w-xs">
                        <div className="h-1.5 w-full bg-secondary rounded-full overflow-hidden">
                          <div
                            className="h-full bg-primary transition-all duration-300"
                            style={{ width: `${goal.progress_percent}%` }}
                          />
                        </div>
                        <span className="text-[11px] font-mono text-muted-foreground">
                          {goal.progress_percent}%
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  {!archived && <fieldset aria-label={`Actions for ${goal.title}`} disabled={createMutation.isPending || updateMutation.isPending || reopenMutation.isPending} className="flex flex-wrap items-center gap-2 self-end sm:self-auto">
                    <Button size="sm" variant="ghost" onClick={() => { setEditingId(goal.id); setNewTitle(goal.title); setNewProgress(goal.progress_percent ?? ""); setIsCreating(true); createMutation.reset(); }}>Edit</Button>
                    {!isCompleted ? (
                      <>
                        <div className="flex items-center gap-1">
                          <span className="text-xs text-muted-foreground">{goal.progress_percent === null ? "No progress set" : `${goal.progress_percent}%`}</span>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs gap-1"
                          onClick={() =>
                            updateMutation.mutate({
                              id: goal.id,
                              status: "completed",
                            })
                          }
                          disabled={updateMutation.isPending}
                        >
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          Complete
                        </Button>
                      </>
                    ) : inGrace ? (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs gap-1"
                        onClick={() => reopenMutation.mutate(goal.id)}
                        disabled={reopenMutation.isPending}
                      >
                        <RotateCcw className="h-3.5 w-3.5" />
                        Reopen
                      </Button>
                    ) : null}
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
