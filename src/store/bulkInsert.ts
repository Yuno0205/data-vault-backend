import type { VaultProgressEvent } from "../messaging/protocol";
import { RecordStore, type RecordItem } from "./recordStore";
import { IndexStore } from "./indexStore";

type BulkInsertOptions = {
  totalCount: number;
  chunkSize?: number;
  startIndex?: number;
  targetWindow: WindowProxy;
  targetOrigin: string;
};

function createRecord(index: number): RecordItem {
  return {
    id: String(index),
    name: `User ${index}`,
    email: `user${index}@test.com`,
    status: index % 2 === 0 ? "active" : "inactive",
  };
}

function emitProgress(
  targetWindow: WindowProxy,
  targetOrigin: string,
  processed: number,
  total: number,
) {
  const event: VaultProgressEvent = {
    type: "records.bulkInsert.progress",
    data: {
      processed,
      total,
      percent: Math.floor((processed / total) * 100),
    },
  };

  targetWindow.postMessage(event, targetOrigin);
}

function yieldToEventLoop() {
  return new Promise<void>((resolve) => {
    window.setTimeout(resolve, 0);
  });
}

export async function bulkInsertRecords(
  recordStore: RecordStore,
  indexStore: IndexStore,
  options: BulkInsertOptions,
) {
  const totalCount = options.totalCount;
  const chunkSize = options.chunkSize ?? 1000;
  const startIndex = options.startIndex ?? recordStore.size();

  let processed = 0;

  while (processed < totalCount) {
    const remaining = totalCount - processed;
    const currentChunkSize = Math.min(chunkSize, remaining);

    const chunk: RecordItem[] = [];

    for (let i = 0; i < currentChunkSize; i++) {
      const nextIndex = startIndex + processed + i;
      chunk.push(createRecord(nextIndex));
    }

    recordStore.upsertMany(chunk);

    for (const item of chunk) {
      indexStore.add(item);
    }

    processed += currentChunkSize;

    emitProgress(
      options.targetWindow,
      options.targetOrigin,
      processed,
      totalCount,
    );

    await yieldToEventLoop();
  }

  return {
    inserted: totalCount,
    totalRecords: recordStore.size(),
  };
}
