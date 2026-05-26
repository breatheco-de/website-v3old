let _workerRunNow: (() => void) | null = null;

export function setWorkerRunNow(fn: (() => void) | null): void {
  _workerRunNow = fn;
}

export function triggerWorkerRunNow(): void {
  if (_workerRunNow) _workerRunNow();
}
