import type { ChatCitation } from "./types";

export type NumberedSource = {
  number: number;
  referenceId: string;
  title: string;
  publisher: string;
  url: string;
  citedTexts: string[];
};

/** One number per distinct reference, in order of first citation. Used for markers, list labels, and focus targets. */
export function numberCitationSources(citations: readonly ChatCitation[]): NumberedSource[] {
  const sources = new Map<string, NumberedSource>();
  for (const citation of citations) {
    const existing = sources.get(citation.referenceId);
    if (existing) {
      if (!existing.citedTexts.includes(citation.citedText)) existing.citedTexts.push(citation.citedText);
      continue;
    }
    sources.set(citation.referenceId, {
      number: sources.size + 1,
      referenceId: citation.referenceId,
      title: citation.title,
      publisher: citation.publisher,
      url: citation.url,
      citedTexts: [citation.citedText],
    });
  }
  return Array.from(sources.values());
}

export function citationMarkers(blockCitations: readonly ChatCitation[], sources: readonly NumberedSource[]) {
  const numbers: number[] = [];
  for (const citation of blockCitations) {
    const number = sources.find((source) => source.referenceId === citation.referenceId)?.number;
    if (number !== undefined && !numbers.includes(number)) numbers.push(number);
  }
  return numbers;
}

export function citationSourceElementId(messageIndex: number, number: number) {
  return `citation-source-${messageIndex}-${number}`;
}

function normalizeUrl(value: string) {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    url.hash = "";
    if (url.pathname.length > 1 && url.pathname.endsWith("/")) url.pathname = url.pathname.slice(0, -1);
    return url.href;
  } catch {
    return null;
  }
}

export function buildApprovedUrlSet(urls: readonly string[]) {
  return new Set(urls.map(normalizeUrl).filter((url): url is string => url !== null));
}

/** Returns a clickable href only when the URL matches a server-provided reference URL. */
export function approvedHref(value: string, approvedUrls: ReadonlySet<string>) {
  const href = normalizeUrl(value);
  return href !== null && approvedUrls.has(href) ? href : null;
}
