import type { StorageArea } from "../../src/lib/storage";

export function createFakeStorageArea(): StorageArea {
  const data: Record<string, unknown> = {};
  return {
    async get(keys) {
      if (keys === null || keys === undefined) return { ...data };
      const keyList = Array.isArray(keys) ? keys : [keys];
      const result: Record<string, unknown> = {};
      for (const k of keyList) result[k] = data[k];
      return result;
    },
    async set(items) {
      Object.assign(data, items);
    },
    async remove(keys) {
      const keyList = Array.isArray(keys) ? keys : [keys];
      for (const k of keyList) delete data[k];
    },
  };
}
