import { RecordStore, type RecordItem } from "./recordStore";
import { IndexStore } from "./indexStore";

type BulkUpdateStatusProgressEvent = {
  type: "records.bulkUpdateStatus.progress";
  data: {
    processed: number;
    total: number;
    percent: number;
  };
};

type Options = {
  status: "active" | "inactive";
  targetWindow: WindowProxy;
  targetOrigin: string;
  chunkSize?: number;
};

function emitProgress(
  targetWindow: WindowProxy,
  targetOrigin: string,
  processed: number,
  total: number,
) {
  const percent = total === 0 ? 100 : Math.floor((processed / total) * 100);

  const event: BulkUpdateStatusProgressEvent = {
    type: "records.bulkUpdateStatus.progress",
    data: {
      processed,
      total,
      percent,
    },
  };

  targetWindow.postMessage(event, targetOrigin);
}

function yieldToEventLoop() {
  return new Promise<void>((resolve) => {
    window.setTimeout(resolve, 0);
  });
}

export async function bulkUpdateStatus(
  recordStore: RecordStore,
  indexStore: IndexStore,
  options: Options,
) {
  const chunkSize = options.chunkSize ?? 2000;

  const allIds = recordStore.getAllIds();

  // Chỉ lấy những record thật sự cần update
  const targetIds = allIds.filter((id) => {
    const record = recordStore.getById(id);
    return record !== undefined && record.status !== options.status;
  });

  const total = targetIds.length;

  // Không có gì để update
  if (total === 0) {
    emitProgress(options.targetWindow, options.targetOrigin, 0, 0);

    return {
      updated: 0,
      status: options.status,
      totalRecords: recordStore.size(),
    };
  }

  let processed = 0;

  while (processed < total) {
    const chunkIds = targetIds.slice(processed, processed + chunkSize);

    const updatedChunk: RecordItem[] = [];

    for (const id of chunkIds) {
      const record = recordStore.getById(id);
      if (!record) continue;

      // double-check cho chắc
      if (record.status === options.status) continue;

      // remove khỏi index cũ
      indexStore.remove(record);

      const updated: RecordItem = {
        ...record,
        status: options.status,
      };

      updatedChunk.push(updated);
    }

    // upsert batch
    if (updatedChunk.length > 0) {
      recordStore.upsertMany(updatedChunk);

      for (const item of updatedChunk) {
        indexStore.add(item);
      }
    }

    processed += chunkIds.length;

    emitProgress(options.targetWindow, options.targetOrigin, processed, total);

    await yieldToEventLoop();
  }

  return {
    updated: total,
    status: options.status,
    totalRecords: recordStore.size(),
  };
}
