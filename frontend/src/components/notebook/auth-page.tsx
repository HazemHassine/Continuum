"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowRight, LockKeyhole } from "lucide-react";
import { useAuth } from "@/context/auth-context";
import { Mark, NotebookLogo, Paper } from "./sketch";

const schema = z.object({
  email: z.string().trim().email("Use a valid email address."),
  password: z
    .string()
    .min(6, "Use at least 6 characters.")
    .refine(
      (value) => new TextEncoder().encode(value).length <= 72,
      "Use a password of 72 bytes or fewer.",
    ),
});
type Fields = z.infer<typeof schema>;
export function AuthPage({ mode }: { mode: "login" | "register" }) {
  const creating = mode === "register";
  const router = useRouter();
  const auth = useAuth();
  const [error, setError] = useState("");
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<Fields>({
    resolver: zodResolver(schema),
    defaultValues: { email: "", password: "" },
  });
  async function submit(values: Fields) {
    setError("");
    try {
      if (creating) await auth.register(values.email, values.password);
      else await auth.login(values.email, values.password);
      const redirect = new URLSearchParams(window.location.search).get(
        "redirectTo",
      );
      router.replace(
        redirect?.startsWith("/") && !redirect.startsWith("//")
          ? redirect
          : "/dashboard",
      );
      router.refresh();
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Something went wrong. Please try again.",
      );
    }
  }
  return (
    <main className="auth-shell">
      <div className="auth-content">
        <Link href="/" aria-label="Continuum home">
          <NotebookLogo />
        </Link>
        <Paper>
          <span className="eyebrow">
            {creating ? "The first page" : "Pick up where you left off"}
          </span>
          <h1>
            {creating ? (
              <>
                A little space,
                <br />
                <Mark>just for you.</Mark>
              </>
            ) : (
              <>
                Your notebook
                <br />
                is <Mark>right here.</Mark>
              </>
            )}
          </h1>
          <p className="auth-subtitle">
            {creating
              ? "For your ideas, your progress, and all the little things in between."
              : "Come in. Find your place. Start wherever you are."}
          </p>
          {error && (
            <p role="alert" className="error-note">
              {error}
            </p>
          )}
          <form className="notebook-form" onSubmit={handleSubmit(submit)}>
            <fieldset disabled={isSubmitting} className="contents">
              <label htmlFor="email">
                Email
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  placeholder="you@somewhere.com"
                  {...register("email")}
                  aria-invalid={!!errors.email}
                />
                {errors.email && (
                  <span className="text-destructive">
                    {errors.email.message}
                  </span>
                )}
              </label>
              <label htmlFor="password">
                Password
                <input
                  id="password"
                  type="password"
                  autoComplete={creating ? "new-password" : "current-password"}
                  placeholder={
                    creating ? "At least 6 characters" : "Your password"
                  }
                  {...register("password")}
                  aria-invalid={!!errors.password}
                />
                {errors.password && (
                  <span className="text-destructive">
                    {errors.password.message}
                  </span>
                )}
              </label>
              <button type="submit" className="ink-button w-full mt-2">
                {isSubmitting
                  ? creating
                    ? "Preparing your notebook…"
                    : "Opening your notebook…"
                  : creating
                    ? "Make this space yours"
                    : "Open your notebook"}
                <ArrowRight size={14} />
              </button>
            </fieldset>
          </form>
          <p className="auth-footnote">
            {creating ? "Already have a notebook? " : "New around here? "}
            <Link href={creating ? "/login" : "/register"}>
              {creating ? "Come back in" : "Start your own"}
            </Link>
          </p>
          <p className="form-hint flex justify-center items-center gap-2 mt-6">
            <LockKeyhole size={11} /> A private place for your pages.
          </p>
        </Paper>
        <p className="auth-footer handwriting">Less noise. More life.</p>
      </div>
    </main>
  );
}
