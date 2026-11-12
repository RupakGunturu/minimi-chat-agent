import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import type { ConvMeta, Turn } from './types.js';

type Data = { turns: Turn[]; convs: Record<string, ConvMeta> };

export class Store {
  private turns: Turn[] = [];
  private convs: Record<string, ConvMeta> = {};
  private q: Promise<unknown> = Promise.resolve();
  constructor(private file: string) {}

  private key(uid: string, conv: string) { return `${uid}\u0000${conv}`; }

  async init() {
    try {
      const data: Partial<Data> = JSON.parse(await readFile(this.file, 'utf8'));
      this.turns = data.turns ?? [];
      this.convs = data.convs ?? {};
    } catch { /* first run */ }
    return this;
  }

  all(uid: string) { return this.turns.filter((t) => t.uid === uid); }

  conv(uid: string, conv: string) {
    return this.all(uid).filter((t) => t.conv === conv).sort((a, b) => a.ts.localeCompare(b.ts));
  }

  conversations(uid: string) {
    const map = new Map<string, {
      id: string; title: string; snippet: string; updatedAt: string; count: number;
      pinned: boolean; archived: boolean;
    }>();
    for (const t of this.all(uid)) {
      const hit = map.get(t.conv);
      if (!hit) {
        map.set(t.conv, {
          id: t.conv,
          title: t.user.slice(0, 90),
          snippet: t.assistant.slice(0, 110),
          updatedAt: t.ts,
          count: 1,
          pinned: false,
          archived: false,
        });
      } else {
        hit.count++;
        if (t.ts > hit.updatedAt) {
          hit.updatedAt = t.ts;
          hit.snippet = t.assistant.slice(0, 110);
        }
      }
    }
    for (const item of map.values()) {
      const meta = this.convs[this.key(uid, item.id)];
      if (!meta) continue;
      if (meta.title) item.title = meta.title;
      item.pinned = !!meta.pinned;
      item.archived = !!meta.archived;
    }
    return [...map.values()].sort((a, b) => {
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
      return b.updatedAt.localeCompare(a.updatedAt);
    });
  }

  add(t: Turn) { this.turns.push(t); return this.flush(); }

  patch(id: string, p: Partial<Turn>) {
    const t = this.turns.find((x) => x.id === id);
    if (t) Object.assign(t, p);
    return this.flush();
  }

  patchConv(uid: string, conv: string, p: Partial<ConvMeta>) {
    const k = this.key(uid, conv);
    this.convs[k] = { ...this.convs[k], ...p };
    return this.flush();
  }

  deleteConv(uid: string, conv: string) {
    this.turns = this.turns.filter((t) => !(t.uid === uid && t.conv === conv));
    delete this.convs[this.key(uid, conv)];
    return this.flush();
  }

  deleteTurn(uid: string, id: string) {
    const before = this.turns.length;
    this.turns = this.turns.filter((t) => !(t.uid === uid && t.id === id));
    return this.flush().then(() => this.turns.length < before);
  }

  clear(uid: string) {
    const ids = new Set(this.all(uid).map((t) => t.conv));
    this.turns = this.turns.filter((t) => t.uid !== uid);
    for (const id of ids) delete this.convs[this.key(uid, id)];
    return this.flush();
  }

  reset(turns: Turn[]) { this.turns = turns; return this.flush(); }

  private flush() {
    this.q = this.q
      .then(async () => {
        await mkdir(dirname(this.file), { recursive: true });
        const tmp = this.file + '.tmp';
        await writeFile(tmp, JSON.stringify({ turns: this.turns, convs: this.convs }));
        await rename(tmp, this.file);
      })
      .catch((e) => console.error('store write failed', e));
    return this.q;
  }
}
