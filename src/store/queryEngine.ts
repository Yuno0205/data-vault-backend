import { RecordStore } from "./recordStore";
import { IndexStore } from "./indexStore";

export class QueryEngine {
  private recordStore: RecordStore;
  private indexStore: IndexStore;

  constructor(recordStore: RecordStore, indexStore: IndexStore) {
    this.recordStore = recordStore;
    this.indexStore = indexStore;
  }

  query(params: {
    search?: string;
    status?: string;
    page?: number;
    pageSize?: number;
  }) {
    const page = Math.max(1, params.page ?? 1);
    const pageSize = Math.max(1, params.pageSize ?? 50);

    const hasSearch = Boolean(params.search?.trim());
    const hasStatus = Boolean(params.status);

    const sets: Set<string>[] = [];

    if (hasSearch) {
      const tokens = params
        .search!.toLowerCase()
        .trim()
        .split(/\s+/)
        .filter(Boolean);

      for (const token of tokens) {
        const tokenSet = this.indexStore.byToken.get(token);

        // Có search nhưng token không tồn tại => không match gì
        if (!tokenSet) {
          return {
            ids: [],
            total: 0,
            page,
            pageSize,
            totalPages: 0,
          };
        }

        sets.push(tokenSet);
      }
    }

    if (hasStatus) {
      const statusSet = this.indexStore.byStatus.get(params.status!);

      if (!statusSet) {
        return {
          ids: [],
          total: 0,
          page,
          pageSize,
          totalPages: 0,
        };
      }

      sets.push(statusSet);
    }

    let matchedIds: string[];

    // Chỉ full data khi thực sự không có search/filter nào
    if (!hasSearch && !hasStatus) {
      matchedIds = this.recordStore.getAllIds();
    } else {
      if (sets.length === 0) {
        return {
          ids: [],
          total: 0,
          page,
          pageSize,
          totalPages: 0,
        };
      }

      sets.sort((a, b) => a.size - b.size);

      let result = new Set<string>(sets[0]);

      for (let i = 1; i < sets.length; i++) {
        result = this.intersect(result, sets[i]);

        if (result.size === 0) {
          break;
        }
      }

      matchedIds = Array.from(result);
    }

    const total = matchedIds.length;
    const totalPages = total === 0 ? 0 : Math.ceil(total / pageSize);

    // Nếu page vượt quá totalPages thì clamp lại
    const safePage = totalPages === 0 ? 1 : Math.min(page, totalPages);

    const start = (safePage - 1) * pageSize;
    const end = start + pageSize;
    const pagedIds = matchedIds.slice(start, end);

    return {
      ids: pagedIds,
      total,
      page: safePage,
      pageSize,
      totalPages,
    };
  }

  private intersect(a: Set<string>, b: Set<string>) {
    const result = new Set<string>();
    const smaller = a.size <= b.size ? a : b;
    const larger = a.size <= b.size ? b : a;

    for (const value of smaller) {
      if (larger.has(value)) {
        result.add(value);
      }
    }

    return result;
  }
}
