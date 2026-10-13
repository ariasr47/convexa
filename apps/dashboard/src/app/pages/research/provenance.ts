/**
 * Provenance: where a figure came from, named in a few characters. A figure cites its sources as `[n]`
 * in the note; this reads the first one and turns its title into a chip label. A primary source is a
 * filing ("8-K 99.1 · Aug 26") or a document the company published ("ir.amd.com · Aug 4"); anything else
 * is named by its site and drawn with a dotted border, the canon's mark for a figure that rests on
 * someone else's work.
 */
import type { NoteInline } from './types';

export type NoteSource = { n: number | null; href: string; label: string; host: string };
export type SourceChipInfo = { text: string; href: string; primary: boolean };

const FORM_RE = /\b(10-K|10-Q|8-K|6-K|20-F|40-F|S-1(?:\/A)?|424B\d?|DEF 14A|13F|Form 4)\b/;
const EXHIBIT_RE = /\bEx(?:hibit|\.)?\s*(99(?:\.\d)?)\b/i;
const DAY_RE = /\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.? (\d{1,2}),? (\d{4})\b/;
const ISO_RE = /\b(\d{4})-(\d{2})-(\d{2})\b/;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** Hosts a company publishes from: the SEC's own record, and investor-relations sites. */
const PRIMARY_HOST_RE = /(^|\.)sec\.gov$|^(ir|investors?)\.|\.q4cdn\.com$|^investor\./;

/** A source's title as a chip label: "8-K 99.1 · Aug 26", "10-Q · quarter to Jul 26", else its site. */
export function sourceChip(source: NoteSource): SourceChipInfo {
  const host = source.host.replace(/^www\./, '');
  const day = DAY_RE.exec(source.label);
  const iso = ISO_RE.exec(source.label);
  const when = day
    ? `${day[1]} ${Number(day[2])}`
    : iso
      ? `${MONTHS[Number(iso[2]) - 1]} ${Number(iso[3])}`
      : null;
  const form = FORM_RE.exec(source.label)?.[1];
  if (!form) {
    const primary = PRIMARY_HOST_RE.test(host);
    return { text: primary && when ? `${host} · ${when}` : host, href: source.href, primary };
  }
  const exhibit = form === '8-K' || form === '6-K' ? EXHIBIT_RE.exec(source.label)?.[1] : undefined;
  // A periodic report's date is the period it covers, not the day it was filed: say so.
  const period = /\b(quarter|year) ended\b/i.exec(source.label)?.[1]?.toLowerCase();
  const dated = when && period ? `${period} to ${when}` : when;
  return {
    text: [exhibit ? `${form} ${exhibit}` : form, dated].filter(Boolean).join(' · '),
    href: source.href,
    primary: true,
  };
}

/** The text of an inline run, without its markup. */
export function inlineText(nodes: NoteInline[]): string {
  return nodes
    .map((n) => (n.type === 'text' || n.type === 'code' ? n.text : inlineText(n.children)))
    .join('');
}

/** The first `[n]` a run cites, resolved against the note's sources; null when it cites none. */
export function firstSource(nodes: NoteInline[], sources: NoteSource[]): NoteSource | null {
  const n = /\[(\d{1,3})\]/.exec(inlineText(nodes))?.[1];
  return n === undefined ? null : (sources.find((s) => s.n === Number(n)) ?? null);
}
