// Serialize device mutations within a realm and, in browsers, across tabs.
const queues = new Map<string, Promise<unknown>>();

export async function withDeviceLock<T>(name: string, operation: () => Promise<T>): Promise<T> {
  const previous = queues.get(name) ?? Promise.resolve();
  const next = previous
    .catch(() => undefined)
    .then(async () => {
      if (typeof window === "undefined") return await operation();
      if (!navigator.locks) throw new Error("This browser cannot safely coordinate device storage");
      return await navigator.locks.request(`pata:${name}`, operation);
    });
  queues.set(name, next);
  try {
    return await next;
  } finally {
    if (queues.get(name) === next) queues.delete(name);
  }
}
