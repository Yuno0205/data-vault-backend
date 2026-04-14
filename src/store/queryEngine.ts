import { RecordStore } from "./recordStore";
import { IndexStore } from "./indexStore";

export class QueryEngine {
  private recordStore: RecordStore;
  private indexStore: IndexStore;

  constructor(recordStore: RecordStore, indexStore: IndexStore) {
    this.recordStore = recordStore;
    this.indexStore = indexStore;
  }

  query(params: { search?: string; status?: string }) {
    const sets: Set<string>[] = [];

    if (params.search) {
      const tokens = params.search.toLowerCase().split(/\s+/);

      for (const token of tokens) {
        const set = this.indexStore.byToken.get(token);
        if (set) sets.push(set);
      }
    }

    if (params.status) {
      const set = this.indexStore.byStatus.get(params.status);
      if (set) sets.push(set);
    }

    let result: Set<string>;

    if (sets.length === 0) {
      result = new Set(this.recordStore.getAllIds());
    } else {
      sets.sort((a, b) => a.size - b.size);
      result = new Set(sets[0]);

      for (let i = 1; i < sets.length; i++) {
        result = this.intersect(result, sets[i]);
      }
    }

    const ids = Array.from(result);

    return {
      ids,
      total: ids.length,
    };
  }

  private intersect(a: Set<string>, b: Set<string>) {
    const res = new Set<string>();

    for (const v of a) {
      if (b.has(v)) res.add(v);
    }

    return res;
  }
}
