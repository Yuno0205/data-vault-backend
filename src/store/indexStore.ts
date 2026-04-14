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

  private tokenize(text: string): string[] {
    return text.toLowerCase().trim().split(/\s+/).filter(Boolean);
  }

  private addToMapSet(map: Map<string, Set<string>>, key: string, id: string) {
    if (!map.has(key)) map.set(key, new Set());
    map.get(key)!.add(id);
  }
}
