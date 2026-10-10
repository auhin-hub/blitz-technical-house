/**
 * Minimal CSV read/write for the list tools (handoff P1.5). RFC-4180-ish:
 * comma-separated, double-quote escaping ("" for a literal quote), CRLF rows.
 * Browser-only download helper included. No dependency — Excel round-trips fine.
 */

/** Serialise headers + rows to a CSV string (Excel-friendly CRLF + BOM). */
export function toCsv(headers: string[], rows: (string | number | null | undefined)[][]): string {
  const esc = (v: string | number | null | undefined) => {
    const s = v === null || v === undefined ? '' : String(v);
    return /[",\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  };
  const lines = [headers.map(esc).join(',')];
  for (const r of rows) lines.push(r.map(esc).join(','));
  return '﻿' + lines.join('\r\n') + '\r\n';
}

export interface ParsedCsv { headers: string[]; rows: string[][]; }

/** Parse a CSV string into trimmed headers + raw string rows. */
export function parseCsv(text: string): ParsedCsv {
  const s = text.replace(/^﻿/, '');
  const records: string[][] = [];
  let field = '', row: string[] = [], inQ = false, seen = false;
  const endField = () => { row.push(field); field = ''; seen = true; };
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (inQ) {
      if (c === '"') { if (s[i + 1] === '"') { field += '"'; i++; } else inQ = false; }
      else field += c;
    } else if (c === '"') inQ = true;
    else if (c === ',') endField();
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && s[i + 1] === '\n') i++;
      // finish the field, then the row (skip blank lines)
      const hadContent = seen || field !== '';
      row.push(field); field = ''; seen = false;
      if (hadContent && !(row.length === 1 && row[0] === '')) records.push(row);
      row = [];
    } else field += c;
  }
  if (seen || field !== '' || row.length) {
    row.push(field);
    if (!(row.length === 1 && row[0] === '')) records.push(row);
  }
  const headers = (records.shift() ?? []).map((h) => h.trim());
  return { headers, rows: records };
}

/** Trigger a browser download of text as a file. */
export function downloadText(filename: string, text: string, mime = 'text/csv'): void {
  const blob = new Blob([text], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

/** Read a File (from an <input type=file>) as text. */
export function readFileText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(String(fr.result ?? ''));
    fr.onerror = () => reject(fr.error ?? new Error('read failed'));
    fr.readAsText(file);
  });
}

/** Validate that parsed headers contain every required column (order-independent). */
export function missingColumns(headers: string[], required: string[]): string[] {
  const set = new Set(headers.map((h) => h.trim()));
  return required.filter((c) => !set.has(c));
}
