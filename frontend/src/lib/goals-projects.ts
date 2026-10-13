import { apiClient } from "@/lib/api-client";
import { Goal, Project, GoalStatus, ProjectStatus } from "@/types/domain";

export interface CreateGoalInput {
  title: string;
  progress_percent?: number | null;
}

export interface UpdateGoalInput {
  title?: string;
  progress_percent?: number | null;
  status?: GoalStatus;
}

export interface CreateProjectInput {
  title: string;
  description?: string | null;
}

export interface UpdateProjectInput {
  title?: string;
  description?: string | null;
  status?: ProjectStatus;
}

// --- Goals API ---
export async function getGoals(
  filterStatus: "active_workspace" | "archived" | "all" = "active_workspace"
): Promise<Goal[]> {
  return apiClient<Goal[]>(`/api/v1/goals?filter_status=${filterStatus}`);
}

export async function createGoal(input: CreateGoalInput): Promise<Goal> {
  return apiClient<Goal>("/api/v1/goals", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function updateGoal(id: string, input: UpdateGoalInput): Promise<Goal> {
  return apiClient<Goal>(`/api/v1/goals/${id}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export async function reopenGoal(id: string): Promise<Goal> {
  return apiClient<Goal>(`/api/v1/goals/${id}/reopen`, {
    method: "POST",
  });
}

// --- Projects API ---
export async function getProjects(
  filterStatus: "active_workspace" | "archived" | "all" = "active_workspace"
): Promise<Project[]> {
  return apiClient<Project[]>(`/api/v1/projects?filter_status=${filterStatus}`);
}

export async function createProject(input: CreateProjectInput): Promise<Project> {
  return apiClient<Project>("/api/v1/projects", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function updateProject(id: string, input: UpdateProjectInput): Promise<Project> {
  return apiClient<Project>(`/api/v1/projects/${id}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export async function reopenProject(id: string): Promise<Project> {
  return apiClient<Project>(`/api/v1/projects/${id}/reopen`, {
    method: "POST",
  });
}
