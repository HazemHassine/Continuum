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
  loading = false,
  loadError,
  onRetry,
  onClose,
  onChanged,
}: {
  source: EntityRef;
  entities: EntityRef[];
  links: EntityLink[];
  loading?: boolean;
  loadError?: string;
  onRetry: () => void;
  onClose: () => void;
  onChanged: () => void | Promise<unknown>;
}) {
  const [selected, setSelected] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const unavailable = loading || !!loadError;
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
    if (busy || unavailable) return;
    setBusy(true);
    setError("");
    try {
      await action();
      setSelected("");
      await onChanged();
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
    <NotebookDialog title="Connections" onClose={onClose} closeDisabled={busy}>
      <p className="entity-title mb-3">{source.title}</p>
      {loadError ? (
        <p role="alert" className="error-note">
          Couldn’t load all entries and connections.
          <button className="ml-3 underline" onClick={onRetry}>Try again</button>
        </p>
      ) : loading && (
        <p className="form-hint mb-5" role="status">Loading connections…</p>
      )}
      {error && (
        <p role="alert" className="error-note">
          {error}
        </p>
      )}
      {!unavailable && connected.length === 0 && (
        <p className="form-hint mb-5">
          No connections yet.
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
              {entity?.title ?? "Unavailable entry"}
            </div>
            <button
              disabled={busy || unavailable}
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
          Connect another entry
          <select
            value={selected}
            onChange={(event) => setSelected(event.target.value)}
            disabled={busy || unavailable || options.length === 0}
          >
            <option value="">Choose an entry…</option>
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
        {!unavailable && options.length === 0 && (
          <p className="form-hint">
            {connected.length > 0
              ? "All other entries are already connected."
              : "Create another entry before making a connection."}
          </p>
        )}
        <div className="form-actions">
          <button type="button" className="ink-button ghost" disabled={busy} onClick={onClose}>
            Done
          </button>
          <button
            type="submit"
            disabled={busy || unavailable || !selected}
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
