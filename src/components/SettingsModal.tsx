import { useState } from "react";
import type { Settings } from "../types";
import { PROVIDERS, getProvider } from "../lib/providers";

interface Props {
  settings: Settings;
  onSave: (s: Settings) => void;
  onClose: () => void;
}

export function SettingsModal({ settings, onSave, onClose }: Props) {
  const [draft, setDraft] = useState<Settings>({ ...settings, apiKeys: { ...settings.apiKeys } });
  const provider = getProvider(draft.providerId);

  const setProvider = (id: string) => {
    const p = getProvider(id);
    setDraft((d) => ({ ...d, providerId: id, model: p.defaultModel }));
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h2>Settings</h2>
          <button className="icon-btn" onClick={onClose}>
            ×
          </button>
        </div>

        <div className="field">
          <label>Provider</label>
          <div className="segmented">
            {PROVIDERS.map((p) => (
              <button
                key={p.id}
                className={p.id === draft.providerId ? "seg active" : "seg"}
                onClick={() => setProvider(p.id)}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        <div className="field">
          <label>Model</label>
          <input
            list="anvil-models"
            value={draft.model}
            onChange={(e) => setDraft((d) => ({ ...d, model: e.target.value }))}
            placeholder={provider.defaultModel}
          />
          <datalist id="anvil-models">
            {provider.models.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}
              </option>
            ))}
          </datalist>
          <p className="field-hint">Any model id works — pick a suggestion or type your own.</p>
        </div>

        <div className="field">
          <label>Key handling</label>
          <div className="segmented">
            <button
              className={draft.mode === "byok" ? "seg active" : "seg"}
              onClick={() => setDraft((d) => ({ ...d, mode: "byok" }))}
            >
              Bring your own key
            </button>
            <button
              className={draft.mode === "proxy" ? "seg active" : "seg"}
              onClick={() => setDraft((d) => ({ ...d, mode: "proxy" }))}
            >
              Use hosted proxy
            </button>
          </div>
        </div>

        {draft.mode === "byok" ? (
          <div className="field">
            <label>{provider.keyLabel}</label>
            <input
              type="password"
              value={draft.apiKeys[provider.id] ?? ""}
              placeholder={provider.keyPlaceholder}
              onChange={(e) =>
                setDraft((d) => ({
                  ...d,
                  apiKeys: { ...d.apiKeys, [provider.id]: e.target.value },
                }))
              }
            />
            <p className="field-hint">
              Stored only in this browser (localStorage) and sent directly to {provider.label}.
              Get a key at{" "}
              <a href={provider.docsUrl} target="_blank" rel="noreferrer">
                {provider.docsUrl.replace("https://", "")}
              </a>
              .
            </p>
          </div>
        ) : (
          <div className="field">
            <label>Hosted proxy</label>
            <p className="field-hint">
              Requests go to ANVIL's own <code>/api/chat</code> endpoint, which injects a
              server-side key. Set <code>{provider.envVar}</code> in your deployment's
              environment variables to enable it.
            </p>
          </div>
        )}

        <div className="field row">
          <label>Auto-apply file writes</label>
          <input
            type="checkbox"
            checked={draft.autoApply}
            onChange={(e) => setDraft((d) => ({ ...d, autoApply: e.target.checked }))}
          />
        </div>
        <p className="field-hint">
          Off = the agent proposes every change as a diff you approve. On = writes apply
          immediately.
        </p>

        <div className="field">
          <label>Temperature — {draft.temperature.toFixed(1)}</label>
          <input
            type="range"
            min={0}
            max={1}
            step={0.1}
            value={draft.temperature}
            onChange={(e) => setDraft((d) => ({ ...d, temperature: Number(e.target.value) }))}
          />
        </div>

        <div className="modal-actions">
          <button className="btn" onClick={onClose}>
            Cancel
          </button>
          <button
            className="btn primary"
            onClick={() => {
              onSave(draft);
              onClose();
            }}
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
