import type { ProviderConfig } from "../types";

/**
 * User-defined providers — the escape hatch for "any company, any model".
 *
 * A user can add a provider by name + base URL + wire format, and it behaves
 * exactly like a built-in one: it appears in the picker, gets its own API key
 * slot, and supports live model discovery. Persisted separately from settings
 * so `getProvider(id)` can resolve custom ids without threading state around.
 *
 * Custom providers are BYOK-only — the hosted proxy only knows the built-ins.
 */
export interface CustomProvider {
  id: string;
  label: string;
  kind: "openai" | "anthropic";
  baseUrl: string;
  defaultModel: string;
}

const KEY = "anvil.providers.v1";

function isValid(c: unknown): c is CustomProvider {
  const p = c as CustomProvider;
  return (
    !!p &&
    typeof p.id === "string" &&
    typeof p.label === "string" &&
    typeof p.baseUrl === "string" &&
    typeof p.defaultModel === "string" &&
    (p.kind === "openai" || p.kind === "anthropic")
  );
}

export function slugifyId(label: string): string {
  const slug = label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 32);
  return `custom:${slug || Math.random().toString(36).slice(2, 8)}`;
}

type Listener = () => void;

class CustomRegistry {
  private items: CustomProvider[] = [];
  private listeners = new Set<Listener>();

  constructor() {
    this.load();
  }

  private load() {
    try {
      const raw = localStorage.getItem(KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      this.items = Array.isArray(parsed) ? parsed.filter(isValid) : [];
    } catch {
      this.items = [];
    }
  }

  private persist() {
    try {
      localStorage.setItem(KEY, JSON.stringify(this.items));
    } catch {
      /* ignore */
    }
  }

  private emit() {
    this.persist();
    for (const l of this.listeners) l();
  }

  subscribe(l: Listener): () => void {
    this.listeners.add(l);
    return () => this.listeners.delete(l);
  }

  list(): CustomProvider[] {
    return [...this.items];
  }

  get(id: string): CustomProvider | undefined {
    return this.items.find((c) => c.id === id);
  }

  add(input: Omit<CustomProvider, "id">, id = slugifyId(input.label)): CustomProvider {
    const item: CustomProvider = { ...input, id };
    this.items = [...this.items.filter((c) => c.id !== id), item];
    this.emit();
    return item;
  }

  remove(id: string): void {
    this.items = this.items.filter((c) => c.id !== id);
    this.emit();
  }
}

export const customProviders = new CustomRegistry();

export function customToConfig(c: CustomProvider): ProviderConfig {
  return {
    id: c.id,
    label: c.label,
    kind: c.kind,
    baseUrl: c.baseUrl,
    keyLabel: `${c.label} API key`,
    keyPlaceholder: "your API key",
    envVar: "",
    docsUrl: "",
    defaultModel: c.defaultModel,
    color: "#22d3ee",
    requiresKey: true,
    isCustom: true,
    models: [{ id: c.defaultModel, label: c.defaultModel }],
  };
}
