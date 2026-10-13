"use client";

import Link from "next/link";
import { ArrowRight, Check, LockKeyhole } from "lucide-react";
import { useAuth } from "@/context/auth-context";
import {
  Mark,
  MountainSketch,
  NotebookLogo,
  Paper,
} from "@/components/notebook/sketch";

export default function Home() {
  const { user } = useAuth();
  return (
    <main className="landing">
      <header className="landing-header">
        <NotebookLogo />
        <Link
          href={user ? "/dashboard" : "/login"}
          className="ink-button secondary"
        >
          {user ? "Back to your pages" : "Come back in"}
          <ArrowRight size={13} />
        </Link>
      </header>
      <div className="landing-main">
        <div className="landing-copy">
          <span className="eyebrow">A quieter kind of tracker</span>
          <h1>
            A notebook for
            <br />
            the life you’re
            <br />
            <Mark color="#d5dfc2">making.</Mark>
          </h1>
          <p>
            A place for the goals you reach toward, the things you make, and the
            thoughts you want to keep. All connected. All yours.
          </p>
          <div className="landing-cta">
            <Link
              className="ink-button"
              href={user ? "/dashboard" : "/register"}
            >
              {user ? "Open your notebook" : "Start your notebook"}
              <ArrowRight size={15} />
            </Link>
            <span className="handwriting">No perfect pages required. ↗</span>
          </div>
          <span className="form-hint flex items-center gap-2">
            <LockKeyhole size={11} /> Personal. Private. At your own pace.
          </span>
        </div>
        <div
          className="landing-preview"
          aria-label="An illustrated notebook page"
        >
          <Paper>
            <span className="eyebrow">A page of possibilities</span>
            <h2>Make room for what matters.</h2>
            <div className="preview-item">
              <span className="preview-checkbox bg-[#e2ead5]">
                <Check size={12} />
              </span>
              <span>Begin something small</span>
            </div>
            <div className="preview-item">
              <span className="preview-checkbox" />
              <span>Keep a good idea</span>
            </div>
            <div className="preview-item">
              <span className="preview-checkbox" />
              <span>Notice how far you’ve come</span>
            </div>
            <div className="progress-track mt-6">
              <div className="progress-ink" style={{ width: "38%" }} />
            </div>
            <p className="preview-caption">A little, often.</p>
            <MountainSketch className="!w-44 mt-7" />
          </Paper>
          <Paper tone="yellow" className="sticky-card">
            <p className="sticky-content">
              Maybe the point
              <br />
              isn’t to do more.
              <br />
              It’s to make it
              <br />
              mean something.
            </p>
            <span className="record text-[10px] text-[#a59964] mt-4 block">
              a thought in the margin
            </span>
          </Paper>
        </div>
      </div>
      <footer className="landing-bottom">
        <span>Goals · Projects · Notes · Library · Timeline</span>
        <span className="handwriting">“A tracker for the life I want.”</span>
      </footer>
    </main>
  );
}
