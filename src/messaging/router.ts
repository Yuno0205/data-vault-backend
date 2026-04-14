import type { VaultRequest, VaultResponse } from "./protocol";

type RecordItem = {
  id: string;
  name: string;
  email: string;
  status: "active" | "inactive";
};

const mockRecords: RecordItem[] = [
  { id: "1", name: "John Doe", email: "john@example.com", status: "active" },
  {
    id: "2",
    name: "Jane Smith",
    email: "jane@example.com",
    status: "inactive",
  },
  { id: "3", name: "Alex Brown", email: "alex@example.com", status: "active" },
];

export function setupVaultRouter(allowedOrigin: string) {
  const handleMessage = (event: MessageEvent<VaultRequest>) => {
    if (event.origin !== allowedOrigin) return;

    const request = event.data;
    if (!request || !request.id || !request.action) return;

    let response: VaultResponse;

    try {
      switch (request.action) {
        case "ping":
          response = {
            id: request.id,
            status: "success",
            data: "pong from data vault",
          };
          break;

        case "records.query":
          response = {
            id: request.id,
            status: "success",
            data: {
              items: mockRecords,
              total: mockRecords.length,
            },
          };
          break;

        default:
          response = {
            id: request.id,
            status: "error",
            error: `Unsupported action: ${request.action}`,
          };
      }
    } catch (error) {
      response = {
        id: request.id,
        status: "error",
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }

    if (event.source && "postMessage" in event.source) {
      (event.source as WindowProxy).postMessage(response, event.origin);
    }
  };

  window.addEventListener("message", handleMessage);

  return () => {
    window.removeEventListener("message", handleMessage);
  };
}
