import type { RecordItem } from "./recordStore";

export class IndexStore {
  byStatus = new Map<string, Set<string>>();
  byToken = new Map<string, Set<string>>();

  add(item: RecordItem) {
    this.addToMapSet(this.byStatus, item.status, item.id);

    const tokens = this.tokenize(item.name + " " + item.email);
    for (const token of tokens) {
      this.addToMapSet(this.byToken, token, item.id);
    }
  }

  remove(item: RecordItem) {
    this.removeFromMapSet(this.byStatus, item.status, item.id);

    const tokens = this.tokenize(item.name + " " + item.email);
    for (const token of tokens) {
      this.removeFromMapSet(this.byToken, token, item.id);
    }
  }

  private tokenize(text: string): string[] {
    return text.toLowerCase().trim().split(/\s+/).filter(Boolean);
  }

  private addToMapSet(map: Map<string, Set<string>>, key: string, id: string) {
    if (!map.has(key)) {
      map.set(key, new Set());
    }

    map.get(key)!.add(id);
  }

  private removeFromMapSet(
    map: Map<string, Set<string>>,
    key: string,
    id: string,
  ) {
    const set = map.get(key);
    if (!set) return;

    set.delete(id);

    if (set.size === 0) {
      map.delete(key);
    }
  }
}
