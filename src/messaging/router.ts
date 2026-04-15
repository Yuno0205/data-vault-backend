import type { VaultRequest, VaultResponse } from "./protocol";
import { RecordStore } from "../store/recordStore";
import type { RecordItem } from "../store/recordStore";
import { IndexStore } from "../store/indexStore";
import { QueryEngine } from "../store/queryEngine";
import { bulkInsertRecords } from "../store/bulkInsert";

type QueryPayload = {
  search?: string;
  status?: "active" | "inactive";
  page?: number;
  pageSize?: number;
};

type GetByIdsPayload = {
  ids: string[];
};

type BulkInsertPayload = {
  count?: number;
};

const recordStore = new RecordStore();
const indexStore = new IndexStore();
const queryEngine = new QueryEngine(recordStore, indexStore);

function generateData(n: number): RecordItem[] {
  const data: RecordItem[] = [];

  for (let i = 0; i < n; i++) {
    data.push({
      id: String(i),
      name: `User ${i}`,
      email: `user${i}@test.com`,
      status: i % 2 === 0 ? "active" : "inactive",
    });
  }

  return data;
}

const initialData = generateData(10000);
recordStore.upsertMany(initialData);
initialData.forEach((item) => indexStore.add(item));

export function setupVaultRouter(allowedOrigin: string) {
  const handler = async (event: MessageEvent<VaultRequest>) => {
    if (event.origin !== allowedOrigin) return;

    const request = event.data;
    if (!request || !request.id || !request.action) return;
    if (!(event.source && "postMessage" in event.source)) return;

    let response: VaultResponse;

    try {
      switch (request.action) {
        case "ping": {
          response = {
            id: request.id,
            status: "success",
            data: "pong from data vault 🚀",
          };
          break;
        }

        case "records.query": {
          const payload = (request.payload ?? {}) as QueryPayload;
          const result = queryEngine.query(payload);

          response = {
            id: request.id,
            status: "success",
            data: {
              items: recordStore.getByIds(result.ids),
              total: result.total,
              page: result.page,
              pageSize: result.pageSize,
              totalPages: result.totalPages,
            },
          };
          break;
        }

        case "records.getByIds": {
          const payload = request.payload as GetByIdsPayload;

          response = {
            id: request.id,
            status: "success",
            data: recordStore.getByIds(payload.ids),
          };
          break;
        }

        case "records.bulkInsert": {
          const payload = (request.payload ?? {}) as BulkInsertPayload;
          const count = Math.max(1, payload.count ?? 50000);

          const result = await bulkInsertRecords(recordStore, indexStore, {
            totalCount: count,
            chunkSize: 1000,
            startIndex: recordStore.size(),
            targetWindow: event.source as WindowProxy,
            targetOrigin: event.origin,
          });

          response = {
            id: request.id,
            status: "success",
            data: result,
          };
          break;
        }

        default: {
          response = {
            id: request.id,
            status: "error",
            error: `Unknown action: ${request.action}`,
          };
        }
      }
    } catch (err) {
      response = {
        id: request.id,
        status: "error",
        error: err instanceof Error ? err.message : "Unknown error",
      };
    }

    (event.source as WindowProxy).postMessage(response, event.origin);
  };

  window.addEventListener("message", handler);

  return () => {
    window.removeEventListener("message", handler);
  };
}
