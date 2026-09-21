'use client';

// The panel that opens when you click a number: what it is, how it was worked
// out, and the rows behind it. A native <dialog>, so Esc, focus and the backdrop
// behave the way the browser already does them.

import { useEffect, useRef, type ReactNode } from 'react';

export function Detail({
  title,
  value,
  onClose,
  children,
}: {
  title: string;
  /** The headline figure, repeated so the panel stands on its own. */
  value?: ReactNode;
  onClose: () => void;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (dialog && !dialog.open) dialog.showModal();
  }, []);

  return (
    <dialog
      ref={ref}
      className="statpanel"
      aria-labelledby="detail-h"
      onClose={onClose}
      onClick={(e) => {
        // A click on the backdrop lands on the dialog element itself.
        if (e.target === ref.current) ref.current?.close();
      }}
    >
      <div className="statpanel-in">
        <header>
          <div>
            <h2 id="detail-h">{title}</h2>
            {value !== undefined && <p className="hero">{value}</p>}
          </div>
          <button type="button" onClick={() => ref.current?.close()} aria-label="Close">
            Close
          </button>
        </header>
        {children}
      </div>
    </dialog>
  );
}

/** A plain-words paragraph inside a Detail: what this number means. */
export function Explain({ children }: { children: ReactNode }) {
  return <p className="explain">{children}</p>;
}

/** A small table inside a Detail. `right` lists the column indexes holding numbers. */
export function DetailTable({
  head,
  rows,
  foot,
  right = [],
  empty = 'Nothing on file.',
}: {
  head: string[];
  rows: ReactNode[][];
  foot?: ReactNode[];
  right?: number[];
  empty?: string;
}) {
  if (!rows.length) return <p className="empty-note">{empty}</p>;
  const cls = (i: number) => (right.includes(i) ? 'r' : undefined);
  return (
    <div className="statpanel-scroll">
      <table className="statpanel-table">
        <thead>
          <tr>
            {head.map((h, i) => (
              <th key={h} className={cls(i)} scope="col">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, r) => (
            <tr key={r}>
              {row.map((cell, i) => (
                <td key={i} className={cls(i)}>
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
        {foot && (
          <tfoot>
            <tr>
              {foot.map((cell, i) => (
                <td key={i} className={cls(i)}>
                  {cell}
                </td>
              ))}
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  );
}
