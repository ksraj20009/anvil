/**
 * @-mention support for the composer: reference project files in a prompt and
 * have their contents attached to the message sent to the model.
 */

const MENTION_RE = /(?:^|\s)@([A-Za-z0-9_./-]+)/g;

export function extractMentions(text: string): string[] {
  const set = new Set<string>();
  let m: RegExpExecArray | null;
  MENTION_RE.lastIndex = 0;
  while ((m = MENTION_RE.exec(text)) !== null) set.add(m[1]);
  return [...set];
}

/** Return the file paths mentioned in `text` that actually exist. */
export function validMentions(text: string, files: string[]): string[] {
  const set = new Set(files);
  return extractMentions(text).filter((p) => set.has(p));
}

/**
 * Append the contents of mentioned files to the message, wrapped in tags the
 * model can recognise. Unknown mentions are left untouched.
 */
export function expandMentions(text: string, fileContents: Record<string, string>): string {
  const mentioned = validMentions(text, Object.keys(fileContents));
  if (mentioned.length === 0) return text;
  const blocks = mentioned
    .map((p) => `<file path="${p}">\n${fileContents[p]}\n</file>`)
    .join("\n\n");
  return `${text}\n\n---\nReferenced files:\n\n${blocks}`;
}

/** Suggest file paths for the mention autocomplete. */
export function suggestMentions(query: string, files: string[], limit = 8): string[] {
  const q = query.toLowerCase();
  if (!q) return files.slice(0, limit);
  return files
    .filter((f) => f.toLowerCase().includes(q))
    .sort((a, b) => {
      const ai = a.toLowerCase().indexOf(q);
      const bi = b.toLowerCase().indexOf(q);
      return ai - bi || a.length - b.length;
    })
    .slice(0, limit);
}
