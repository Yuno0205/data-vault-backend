import type { VaultRequest, VaultResponse } from "./protocol";
import { RecordStore, type RecordItem } from "../store/recordStore";
import { IndexStore } from "../store/indexStore";
import { QueryEngine } from "../store/queryEngine";

// ===== TYPE PAYLOAD =====
type QueryPayload = {
  search?: string;
  status?: "active" | "inactive";
};

type GetByIdsPayload = {
  ids: string[];
};

// ===== INIT ENGINE =====
const recordStore = new RecordStore();
const indexStore = new IndexStore();
const queryEngine = new QueryEngine(recordStore, indexStore);

// ===== GENERATE FAKE DATA =====
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

// ===== LOAD INITIAL DATA =====
const initialData = generateData(10000);
recordStore.upsertMany(initialData);
initialData.forEach((item) => indexStore.add(item));

// ===== ROUTER =====
export function setupVaultRouter(allowedOrigin: string) {
  const handler = (event: MessageEvent<VaultRequest>) => {
    if (event.origin !== allowedOrigin) return;

    const request = event.data;
    if (!request || !request.id || !request.action) return;

    let response: VaultResponse;

    try {
      switch (request.action) {
        // ===== PING =====
        case "ping": {
          response = {
            id: request.id,
            status: "success",
            data: "pong from data vault 🚀",
          };
          break;
        }

        // ===== QUERY RECORDS =====
        case "records.query": {
          const payload = (request.payload ?? {}) as QueryPayload;

          const result = queryEngine.query(payload);

          response = {
            id: request.id,
            status: "success",
            data: {
              items: recordStore.getByIds(result.ids),
              total: result.total,
            },
          };
          break;
        }

        // ===== GET BY IDS =====
        case "records.getByIds": {
          const payload = request.payload as GetByIdsPayload;

          response = {
            id: request.id,
            status: "success",
            data: recordStore.getByIds(payload.ids),
          };
          break;
        }

        // ===== DEFAULT =====
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

    // ===== SEND BACK RESPONSE =====
    if (event.source && "postMessage" in event.source) {
      (event.source as WindowProxy).postMessage(response, event.origin);
    }
  };

  window.addEventListener("message", handler);

  return () => {
    window.removeEventListener("message", handler);
  };
}
