"use client";

import { useState } from "react";
import { Link2, X } from "lucide-react";
import { NotebookDialog } from "./dialog";
import { workspaceApi, type EntityRef } from "@/lib/workspace";
import type { EntityLink } from "@/types/domain";

export function otherEnd(
  link: EntityLink,
  ref: EntityRef,
): { id: string; type: string } | null {
  if (link.source_type === ref.type && link.source_id === ref.id)
    return { id: link.target_id, type: link.target_type };
  if (link.target_type === ref.type && link.target_id === ref.id)
    return { id: link.source_id, type: link.source_type };
  return null;
}

export function Connections({
  source,
  entities,
  links,
  onClose,
  onChanged,
}: {
  source: EntityRef;
  entities: EntityRef[];
  links: EntityLink[];
  onClose: () => void;
  onChanged: () => void;
}) {
  const [selected, setSelected] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const connected = links
    .map((link) => ({ link, other: otherEnd(link, source) }))
    .filter((item) => item.other !== null);
  const options = entities.filter(
    (entity) =>
      !(entity.id === source.id && entity.type === source.type) &&
      !connected.some(
        (item) =>
          item.other?.id === entity.id && item.other?.type === entity.type,
      ),
  );
  async function change(action: () => Promise<unknown>) {
    setBusy(true);
    setError("");
    try {
      await action();
      setSelected("");
      onChanged();
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Could not change this connection.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <NotebookDialog title="Connect the dots" onClose={onClose}>
      <p className="form-hint mb-5">
        Connections add context. Nothing has to belong to anything.
      </p>
      <p className="entity-title mb-3">{source.title}</p>
      {error && (
        <p role="alert" className="error-note">
          {error}
        </p>
      )}
      {connected.length === 0 && (
        <p className="form-hint mb-5">
          No connections yet. Start wherever it feels useful.
        </p>
      )}
      {connected.map(({ link, other }) => {
        const entity = entities.find(
          (item) => item.id === other?.id && item.type === other?.type,
        );
        return (
          <div className="link-row" key={link.id}>
            <div>
              <span className="stamp mr-2">
                {other?.type.replaceAll("_", " ")}
              </span>
              {entity?.title ?? "Archived item"}
            </div>
            <button
              disabled={busy}
              aria-label={`Remove connection to ${entity?.title ?? "item"}`}
              className="icon-button"
              onClick={() => change(() => workspaceApi.unlink(link.id))}
            >
              <X size={15} />
            </button>
          </div>
        );
      })}
      <form
        className="notebook-form mt-5"
        onSubmit={(event) => {
          event.preventDefault();
          const target = options.find(
            (item) => `${item.type}:${item.id}` === selected,
          );
          if (target) change(() => workspaceApi.link(source, target));
        }}
      >
        <label>
          Link another page
          <select
            value={selected}
            onChange={(event) => setSelected(event.target.value)}
            disabled={busy}
          >
            <option value="">Choose a page…</option>
            {options.map((item) => (
              <option
                key={`${item.type}:${item.id}`}
                value={`${item.type}:${item.id}`}
              >
                {item.type.replaceAll("_", " ")} · {item.title}
              </option>
            ))}
          </select>
        </label>
        <div className="form-actions">
          <button type="button" className="ink-button ghost" onClick={onClose}>
            Done
          </button>
          <button
            type="submit"
            disabled={busy || !selected}
            className="ink-button"
          >
            <Link2 size={14} />
            {busy ? "Connecting…" : "Connect"}
          </button>
        </div>
      </form>
    </NotebookDialog>
  );
}
