import { useRef, useState, type FormEvent } from "react";

interface Props {
  files: string[];
  active: string;
  onSelect: (path: string) => void;
  onCreate: (path: string) => void;
  onDelete: (path: string) => void;
  onExport: () => void;
  onImport: (file: File) => void;
  onReset: () => void;
}

export function FileExplorer({
  files,
  active,
  onSelect,
  onCreate,
  onDelete,
  onExport,
  onImport,
  onReset,
}: Props) {
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const path = draft.trim();
    if (path) {
      onCreate(path);
      setDraft("");
      setAdding(false);
    }
  };

  return (
    <aside className="explorer">
      <div className="pane-head">
        <span>Explorer</span>
        <div className="pane-actions">
          <button className="icon-btn" title="Export project (.json)" onClick={onExport}>
            ↓
          </button>
          <button className="icon-btn" title="Import project" onClick={() => fileRef.current?.click()}>
            ↑
          </button>
          <button className="icon-btn" title="Reset to starter project" onClick={onReset}>
            ↺
          </button>
          <button className="icon-btn" title="New file" onClick={() => setAdding((v) => !v)}>
            +
          </button>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept=".json,application/json"
          style={{ display: "none" }}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onImport(f);
            e.target.value = "";
          }}
        />
      </div>

      {adding && (
        <form className="new-file" onSubmit={submit}>
          <input
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="src/thing.js"
            onBlur={() => !draft && setAdding(false)}
          />
        </form>
      )}

      <ul className="file-list">
        {files.length === 0 && <li className="empty-hint">No files yet.</li>}
        {files.map((f) => (
          <li
            key={f}
            className={f === active ? "file active" : "file"}
            onClick={() => onSelect(f)}
          >
            <span className="file-name">{f}</span>
            <button
              className="del"
              title="Delete file"
              onClick={(e) => {
                e.stopPropagation();
                onDelete(f);
              }}
            >
              ×
            </button>
          </li>
        ))}
      </ul>
    </aside>
  );
}
