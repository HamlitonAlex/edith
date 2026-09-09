const normalize = value => String(value || "").toLowerCase();
const tokens = value => {
  const text = normalize(value);
  const latin = text.match(/[a-z0-9_-]{2,}/g) || [];
  const chinese = (text.match(/[\u4e00-\u9fff]+/g) || []).flatMap(segment => segment.length < 2 ? [segment] : [...segment].slice(0, -1).map((_, index) => segment.slice(index, index + 2)));
  return [...new Set([...latin, ...chinese])];
};

export function createObsidianIndex(notes) {
  return notes
    .filter(note => String(note.path || "").toLowerCase().endsWith(".md"))
    .map(note => ({ path: note.path, title: note.title || note.path.split(/[\\/]/).at(-1).replace(/\.md$/i, ""), content: String(note.content || ""), terms: tokens(`${note.title || ""} ${note.content || ""}`) }));
}

export function searchObsidian(index, query, limit = 5) {
  const queryTerms = tokens(query);
  if (!queryTerms.length) return [];
  return index.map(note => {
    const hits = queryTerms.filter(term => note.terms.includes(term));
    return { path: note.path, title: note.title, score: hits.length / queryTerms.length, matched_terms: hits };
  }).filter(result => result.score > 0).sort((a, b) => b.score - a.score).slice(0, limit);
}

export function proposeObsidianWrite({ path, title, markdown, learningEvidence }) {
  return {
    kind: "obsidian_write_proposal",
    path,
    title,
    markdown,
    source: "verified_learning",
    learning_evidence: learningEvidence,
    requires_confirmation: true,
    status: "awaiting_user_confirmation",
  };
}
