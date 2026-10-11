import { useState } from "react";
import { vfs } from "../lib/vfs";
import { getViewer, listRepos, pullRepo, pushFiles, type RepoRef } from "../lib/github";
import type { VFile } from "../lib/vfs";

interface Props {
  token: string;
  onTokenChange: (token: string) => void;
  onPullIntoWorkspace: (files: VFile[]) => void;
  onClose: () => void;
}

type Status = { kind: "idle" | "busy" | "ok" | "error"; text: string };

export function GitHubPanel({ token, onTokenChange, onPullIntoWorkspace, onClose }: Props) {
  const [draftToken, setDraftToken] = useState(token);
  const [viewer, setViewer] = useState<string | null>(null);
  const [repos, setRepos] = useState<RepoRef[]>([]);
  const [repo, setRepo] = useState("");
  const [branch, setBranch] = useState("");
  const [message, setMessage] = useState("Update from ANVIL");
  const [status, setStatus] = useState<Status>({ kind: "idle", text: "" });

  const selected = repos.find((r) => r.fullName === repo);

  const connect = async () => {
    setStatus({ kind: "busy", text: "Connecting…" });
    try {
      onTokenChange(draftToken.trim());
      const [me, list] = await Promise.all([getViewer(draftToken.trim()), listRepos(draftToken.trim())]);
      setViewer(me.login);
      setRepos(list);
      if (list.length) {
        setRepo(list[0].fullName);
        setBranch(list[0].defaultBranch);
      }
      setStatus({ kind: "ok", text: `Connected as ${me.login} — ${list.length} repos.` });
    } catch (e) {
      setViewer(null);
      setRepos([]);
      setStatus({ kind: "error", text: e instanceof Error ? e.message : String(e) });
    }
  };

  const pull = async () => {
    if (!repo) return;
    setStatus({ kind: "busy", text: "Pulling…" });
    try {
      const files = await pullRepo(draftToken.trim(), repo, branch || "main", (done, total) =>
        setStatus({ kind: "busy", text: `Pulling ${done}/${total}…` })
      );
      onPullIntoWorkspace(files);
      setStatus({ kind: "ok", text: `Pulled ${files.length} files from ${repo}@${branch}.` });
    } catch (e) {
      setStatus({ kind: "error", text: e instanceof Error ? e.message : String(e) });
    }
  };

  const push = async () => {
    if (!repo) return;
    setStatus({ kind: "busy", text: "Pushing…" });
    try {
      const files = vfs.snapshot();
      const res = await pushFiles(draftToken.trim(), repo, branch || "main", files, message);
      setStatus({ kind: "ok", text: `Pushed ${files.length} files — ${res.url}` });
    } catch (e) {
      setStatus({ kind: "error", text: e instanceof Error ? e.message : String(e) });
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h2>GitHub</h2>
          <button className="icon-btn" onClick={onClose}>
            ×
          </button>
        </div>

        <div className="field">
          <label>Personal access token</label>
          <input
            type="password"
            value={draftToken}
            placeholder="ghp_… (repo scope)"
            onChange={(e) => setDraftToken(e.target.value)}
          />
          <p className="field-hint">
            Stored only in this browser and sent directly to api.github.com. Create one with
            the <code>repo</code> scope at github.com/settings/tokens.
          </p>
        </div>

        <div className="modal-actions" style={{ justifyContent: "flex-start" }}>
          <button className="btn primary" onClick={connect} disabled={!draftToken.trim()}>
            Connect
          </button>
        </div>

        {viewer && (
          <>
            <div className="field">
              <label>Repository</label>
              <select
                value={repo}
                onChange={(e) => {
                  setRepo(e.target.value);
                  const r = repos.find((x) => x.fullName === e.target.value);
                  if (r) setBranch(r.defaultBranch);
                }}
              >
                {repos.map((r) => (
                  <option key={r.fullName} value={r.fullName}>
                    {r.fullName} {r.isPrivate ? "· private" : ""}
                  </option>
                ))}
              </select>
            </div>

            <div className="field">
              <label>Branch</label>
              <input value={branch} onChange={(e) => setBranch(e.target.value)} placeholder="main" />
            </div>

            <div className="field">
              <label>Commit message</label>
              <input value={message} onChange={(e) => setMessage(e.target.value)} />
            </div>

            <div className="modal-actions" style={{ justifyContent: "flex-start", flexWrap: "wrap" }}>
              <button className="btn" onClick={pull} disabled={!selected}>
                ⬇ Pull into workspace
              </button>
              <button className="btn" onClick={push} disabled={!selected}>
                ⬆ Push workspace
              </button>
            </div>
            <p className="field-hint">
              Pull replaces your current files with the repo's text files (max 150). Push
              commits every workspace file to the branch.
            </p>
          </>
        )}

        {status.text && (
          <p
            className={`field-hint gh-status ${
              status.kind === "error" ? "err" : status.kind === "ok" ? "ok" : ""
            }`}
          >
            {status.text}
          </p>
        )}
      </div>
    </div>
  );
}
