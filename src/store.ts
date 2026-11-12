import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import type { Turn } from './types.js';

/** Append-mostly JSON store. No native deps, so `npm install` can't fail on a build step. */
export class Store {
  private turns: Turn[] = [];
  private q: Promise<unknown> = Promise.resolve();
  constructor(private file: string) {}

  async init() {
    try { this.turns = JSON.parse(await readFile(this.file, 'utf8')).turns ?? []; } catch { /* first run */ }
    return this;
  }
  all(uid: string) { return this.turns.filter((t) => t.uid === uid); }
  conv(uid: string, conv: string) {
    return this.all(uid).filter((t) => t.conv === conv).sort((a, b) => a.ts.localeCompare(b.ts));
  }
  conversations(uid: string) {
    const map = new Map<string, { id: string; title: string; snippet: string; updatedAt: string; count: number }>();
    for (const t of this.all(uid)) {
      const hit = map.get(t.conv);
      if (!hit) {
        map.set(t.conv, { id: t.conv, title: t.user.slice(0, 90), snippet: t.assistant.slice(0, 110), updatedAt: t.ts, count: 1 });
      } else {
        hit.count++;
        if (t.ts > hit.updatedAt) { hit.updatedAt = t.ts; hit.snippet = t.assistant.slice(0, 110); }
      }
    }
    return [...map.values()].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }
  add(t: Turn) { this.turns.push(t); return this.flush(); }
  patch(id: string, p: Partial<Turn>) {
    const t = this.turns.find((x) => x.id === id);
    if (t) Object.assign(t, p);
    return this.flush();
  }
  reset(turns: Turn[]) { this.turns = turns; return this.flush(); }

  private flush() {
    this.q = this.q
      .then(async () => {
        await mkdir(dirname(this.file), { recursive: true });
        const tmp = this.file + '.tmp';
        await writeFile(tmp, JSON.stringify({ turns: this.turns }));
        await rename(tmp, this.file);
      })
      .catch((e) => console.error('store write failed', e));
    return this.q;
  }
}
