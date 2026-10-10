import { useEffect, useMemo, useState } from "react";
import type { Settings } from "../types";
import { PROVIDERS, getProvider, detectProviderFromKey } from "../lib/providers";
import { listModels } from "../lib/llm";

interface Props {
  settings: Settings;
  onSave: (s: Settings) => void;
  onClose: () => void;
}

export function SettingsModal({ settings, onSave, onClose }: Props) {
  const [draft, setDraft] = useState<Settings>({ ...settings, apiKeys: { ...settings.apiKeys } });
  const [models, setModels] = useState<string[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [modelError, setModelError] = useState<string | null>(null);
  const [latency, setLatency] = useState<number | null>(null);
  const [nonce, setNonce] = useState(0);

  const provider = getProvider(draft.providerId);
  const key = draft.apiKeys[provider.id] ?? "";
  const detected = detectProviderFromKey(key);

  // Load the live model list whenever the provider, mode, or key changes.
  useEffect(() => {
    if (draft.mode === "byok" && !key.trim()) {
      setModels(null);
      setModelError(null);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setModelError(null);
    setLatency(null);
    const timer = setTimeout(async () => {
      const started = performance.now();
      try {
        const list = await listModels({ provider, mode: draft.mode, apiKey: key });
        if (cancelled) return;
        setLatency(Math.round(performance.now() - started));
        setModels(list);
        if (list.length === 0) setModelError("The provider returned no models for this key.");
        else if (!draft.model.trim()) setDraft((d) => ({ ...d, model: list[0] }));
      } catch (e) {
        if (!cancelled) {
          setModels(null);
          setModelError(e instanceof Error ? e.message : String(e));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 600);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft.providerId, draft.mode, key, nonce]);

  const options = useMemo(
    () => (models && models.length ? models : provider.models.map((m) => m.id)),
    [models, provider]
  );

  const setProvider = (id: string) => {
    const p = getProvider(id);
    setDraft((d) => ({ ...d, providerId: id, model: p.defaultModel }));
    setModels(null);
    setModelError(null);
  };

  const onKeyChange = (value: string) => {
    const guess = detectProviderFromKey(value);
    setDraft((d) => {
      if (guess && guess !== d.providerId) {
        const p = getProvider(guess);
        return {
          ...d,
          providerId: guess,
          model: p.defaultModel,
          apiKeys: { ...d.apiKeys, [guess]: value },
        };
      }
      return { ...d, apiKeys: { ...d.apiKeys, [d.providerId]: value } };
    });
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
                <span className="seg-dot" style={{ background: p.color }} />
                {p.label}
              </button>
            ))}
          </div>
          <p className="field-hint">
            Pick a provider, or just paste an API key below — ANVIL detects the provider
            from the key automatically.
          </p>
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
              value={key}
              placeholder={provider.keyPlaceholder}
              onChange={(e) => onKeyChange(e.target.value)}
            />
            {detected && detected === draft.providerId && (
              <p className="field-hint ok">
                ✓ Recognised as a {provider.label} key — models load automatically.
              </p>
            )}
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

        <div className="field">
          <label>Model</label>
          <input
            list="anvil-models"
            value={draft.model}
            onChange={(e) => setDraft((d) => ({ ...d, model: e.target.value }))}
            placeholder={provider.defaultModel}
          />
          <datalist id="anvil-models">
            {options.map((id) => (
              <option key={id} value={id} />
            ))}
          </datalist>
          <div className="model-status">
            {loading ? (
              <span className="muted">Loading models…</span>
            ) : modelError ? (
              <span className="err" title={modelError}>
                {modelError}
              </span>
            ) : models ? (
              <span className="ok">
                ✓ {models.length} models{latency != null ? ` · ${latency}ms` : ""} — pick one or type any id.
              </span>
            ) : (
              <span className="muted">
                {draft.mode === "byok"
                  ? "Enter an API key to load this account's models."
                  : "Using suggested models."}
              </span>
            )}
            <button className="btn ghost small" onClick={() => setNonce((n) => n + 1)} disabled={loading}>
              Test connection
            </button>
          </div>
        </div>

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
          <label>Appearance</label>
          <div className="segmented">
            <button
              className={draft.theme === "dark" ? "seg active" : "seg"}
              onClick={() => setDraft((d) => ({ ...d, theme: "dark" }))}
            >
              Dark
            </button>
            <button
              className={draft.theme === "light" ? "seg active" : "seg"}
              onClick={() => setDraft((d) => ({ ...d, theme: "light" }))}
            >
              Light
            </button>
          </div>
        </div>

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
