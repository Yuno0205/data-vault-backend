import type { VaultRequest, VaultResponse } from "./protocol";
import { RecordStore } from "../store/recordStore";
import type { RecordItem } from "../store/recordStore";
import { IndexStore } from "../store/indexStore";
import { QueryEngine } from "../store/queryEngine";
import { bulkInsertRecords } from "../store/bulkInsert";
import { bulkUpdateStatus } from "../store/bulkUpdateStatus";

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

const ALLOWED_ACTIONS = new Set([
  "ping",
  "records.query",
  "records.getByIds",
  "records.bulkInsert",
  "records.bulkUpdateStatus",
]);

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isValidRequest(
  req: unknown,
): req is { id: string; action: string; payload?: unknown } {
  return (
    isObject(req) &&
    typeof req.id === "string" &&
    typeof req.action === "string"
  );
}

function validateQueryPayload(payload: unknown): payload is QueryPayload {
  if (!isObject(payload)) return false;

  if (payload.search !== undefined && typeof payload.search !== "string") {
    return false;
  }

  if (
    payload.status !== undefined &&
    payload.status !== "active" &&
    payload.status !== "inactive"
  ) {
    return false;
  }

  if (
    payload.page !== undefined &&
    (!Number.isInteger(payload.page) || Number(payload.page) < 1)
  ) {
    return false;
  }

  if (
    payload.pageSize !== undefined &&
    (!Number.isInteger(payload.pageSize) ||
      Number(payload.pageSize) < 1 ||
      Number(payload.pageSize) > 100)
  ) {
    return false;
  }

  return true;
}

function validateGetByIdsPayload(payload: unknown): payload is GetByIdsPayload {
  return (
    isObject(payload) &&
    Array.isArray(payload.ids) &&
    payload.ids.every((id) => typeof id === "string")
  );
}

function validateBulkInsertPayload(
  payload: unknown,
): payload is BulkInsertPayload {
  if (!isObject(payload)) return false;

  if (
    payload.count !== undefined &&
    (!Number.isInteger(payload.count) || Number(payload.count) < 1)
  ) {
    return false;
  }

  return true;
}

function validateBulkUpdatePayload(
  p: unknown,
): p is { status: "active" | "inactive" } {
  return (
    typeof p === "object" &&
    p !== null &&
    ((p as any).status === "active" || (p as any).status === "inactive")
  );
}

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

if (recordStore.size() === 0) {
  const initialData = generateData(10000);
  recordStore.upsertMany(initialData);
  initialData.forEach((item) => indexStore.add(item));
}

export function setupVaultRouter(allowedOrigin: string) {
  const handler = async (event: MessageEvent<VaultRequest>) => {
    if (event.origin !== allowedOrigin) return;
    if (!(event.source && "postMessage" in event.source)) return;

    const request = event.data;

    if (!isValidRequest(request)) return;

    if (!ALLOWED_ACTIONS.has(request.action)) {
      (event.source as WindowProxy).postMessage(
        {
          id: request.id,
          status: "error",
          error: "Invalid action",
        } satisfies VaultResponse,
        event.origin,
      );
      return;
    }

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
          const rawPayload = request.payload ?? {};

          if (!validateQueryPayload(rawPayload)) {
            response = {
              id: request.id,
              status: "error",
              error: "Invalid query payload",
            };
            break;
          }

          const safePayload: QueryPayload = {
            search: rawPayload.search?.trim(),
            status: rawPayload.status,
            page: Math.max(1, rawPayload.page ?? 1),
            pageSize: Math.min(100, rawPayload.pageSize ?? 50),
          };

          const vaultStartedAt = performance.now();

          const queryStartedAt = performance.now();
          const result = queryEngine.query(safePayload);
          const queryEndedAt = performance.now();

          const hydrateStartedAt = performance.now();
          const items = recordStore.getByIds(result.ids);
          const hydrateEndedAt = performance.now();

          const vaultEndedAt = performance.now();

          response = {
            id: request.id,
            status: "success",
            data: {
              items,
              total: result.total,
              page: result.page,
              pageSize: result.pageSize,
              totalPages: result.totalPages,
              metrics: {
                queryTimeMs: queryEndedAt - queryStartedAt,
                hydrateTimeMs: hydrateEndedAt - hydrateStartedAt,
                vaultProcessingMs: vaultEndedAt - vaultStartedAt,
              },
            },
          };
          break;
        }

        case "records.getByIds": {
          const rawPayload = request.payload;

          if (!validateGetByIdsPayload(rawPayload)) {
            response = {
              id: request.id,
              status: "error",
              error: "Invalid ids payload",
            };
            break;
          }

          response = {
            id: request.id,
            status: "success",
            data: recordStore.getByIds(rawPayload.ids),
          };
          break;
        }

        case "records.bulkInsert": {
          const rawPayload = request.payload ?? {};

          if (!validateBulkInsertPayload(rawPayload)) {
            response = {
              id: request.id,
              status: "error",
              error: "Invalid bulk insert payload",
            };
            break;
          }

          const count = Math.min(50000, rawPayload.count ?? 50000);

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

        case "records.bulkUpdateStatus": {
          const payload = request.payload ?? {};

          if (!validateBulkUpdatePayload(payload)) {
            response = {
              id: request.id,
              status: "error",
              error: "Invalid bulk update payload",
            };
            break;
          }

          const result = await bulkUpdateStatus(recordStore, indexStore, {
            status: payload.status,
            chunkSize: 2000,
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
