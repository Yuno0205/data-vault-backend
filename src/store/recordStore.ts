export type RecordItem = {
  id: string;
  name: string;
  email: string;
  status: "active" | "inactive";
};

export class RecordStore {
  private records = new Map<string, RecordItem>();

  upsertMany(items: RecordItem[]) {
    for (const item of items) {
      this.records.set(item.id, item);
    }
  }

  getById(id: string) {
    return this.records.get(id);
  }

  getByIds(ids: string[]) {
    return ids
      .map((id) => this.records.get(id))
      .filter(Boolean) as RecordItem[];
  }

  getAllIds() {
    return Array.from(this.records.keys());
  }

  size() {
    return this.records.size;
  }
}
