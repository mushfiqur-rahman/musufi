"use client";

// Reusable editor for a list of small records (facts, Q&A, FAQ, sizes…).
// Used by the product and category forms so the add/remove/reorder logic
// lives in one place.

import type { ReactNode } from "react";

export type RowEditorProps<T> = {
  /** Visible heading for the group (also its accessible name). */
  legend: string;
  hint?: string;
  rows: T[];
  onChange: (rows: T[]) => void;
  /** Value for a freshly added row. */
  blank: () => T;
  /** Renders the inputs for one row. `set` replaces that row. */
  render: (row: T, set: (row: T) => void, index: number) => ReactNode;
  addLabel: string;
  max?: number;
  min?: number;
};

export function RowEditor<T>({ legend, hint, rows, onChange, blank, render, addLabel, max = 30, min = 0 }: RowEditorProps<T>) {
  const set = (i: number) => (row: T) => onChange(rows.map((r, j) => (j === i ? row : r)));
  const remove = (i: number) => onChange(rows.filter((_, j) => j !== i));
  const move = (i: number, d: -1 | 1) => {
    const j = i + d;
    if (j < 0 || j >= rows.length) return;
    const next = rows.slice();
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  };

  return (
    <fieldset className="row-editor">
      <legend>{legend}</legend>
      {hint && <p className="hint">{hint}</p>}
      {rows.length === 0 && <p className="hint">এখনো কিছু নেই।</p>}
      <ol>
        {rows.map((row, i) => (
          <li key={i} className="row-item">
            <div className="row-fields">{render(row, set(i), i)}</div>
            <div className="row-tools">
              <button type="button" onClick={() => move(i, -1)} disabled={i === 0} aria-label={`${i + 1} নম্বর সারি উপরে নিন`}>↑</button>
              <button type="button" onClick={() => move(i, 1)} disabled={i === rows.length - 1} aria-label={`${i + 1} নম্বর সারি নিচে নিন`}>↓</button>
              <button type="button" onClick={() => remove(i)} disabled={rows.length <= min} aria-label={`${i + 1} নম্বর সারি মুছুন`}>✕</button>
            </div>
          </li>
        ))}
      </ol>
      {rows.length < max && (
        <button type="button" className="btn btn-ghost" onClick={() => onChange([...rows, blank()])}>+ {addLabel}</button>
      )}
    </fieldset>
  );
}

/** Labelled input used inside rows; keeps markup consistent and accessible. */
export function Field({ label, children, wide }: { label: string; children: ReactNode; wide?: boolean }) {
  return (
    <label className={`mini-field${wide ? " wide" : ""}`}>
      <span>{label}</span>
      {children}
    </label>
  );
}
