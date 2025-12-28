export interface TypedEventTarget<TEventMap extends Record<string, unknown>>
  extends
    Omit<
      EventTarget,
      "addEventListener" | "removeEventListener" | "dispatchEvent"
    > {
  addEventListener<K extends keyof TEventMap>(
    type: K,
    callback: (
      event: CustomEvent<TEventMap[K]>,
    ) => void,
    options?: AddEventListenerOptions | boolean,
  ): void;

  removeEventListener<K extends keyof TEventMap>(
    type: K,
    callback: (
      event: CustomEvent<TEventMap[K]>,
    ) => void,
    options?: EventListenerOptions | boolean,
  ): void;
}

export function createTypedEventTarget<
  TEventMap extends Record<string, unknown>,
>(): TypedEventTarget<TEventMap> {
  return new EventTarget() as TypedEventTarget<TEventMap>;
}

export function dispatchEvent<
  TEventMap extends Record<string, unknown>,
  TKey extends Extract<keyof TEventMap, string>,
>(
  eventTarget: TypedEventTarget<TEventMap>,
  event: TKey,
  detail: TEventMap[TKey],
): boolean {
  return (eventTarget as EventTarget).dispatchEvent(
    new CustomEvent(event, {
      detail,
    }),
  );
}

interface Options {
  signal?: AbortSignal;
}

/**
 * Converts {@linkcode TypedEventTarget} to {@linkcode AsyncIterableIterator}, similar to `on()` in `node:events`.
 */
export function on<
  TEvents extends Record<string, unknown>,
  TEvent extends keyof TEvents,
>(
  eventTarget: TypedEventTarget<TEvents>,
  event: TEvent,
  options: Options = {},
): AsyncIterableIterator<CustomEvent<TEvents[TEvent]>> {
  type T = CustomEvent<TEvents[TEvent]>;
  // TODO: Optimize the implementation.
  const abortController = new AbortController();
  const signal = options.signal
    ? AbortSignal.any([options.signal, abortController.signal])
    : abortController.signal;
  const readerQueue: Array<PromiseWithResolvers<T>> = [];
  const bufferedEventQueue: Array<T> = [];
  if (!signal.aborted) {
    eventTarget.addEventListener(
      event,
      (event) => {
        if (readerQueue.length) {
          const { resolve } = readerQueue.shift()!;
          resolve(event);
        } else {
          bufferedEventQueue.push(event);
        }
      },
      { signal },
    );
  }
  function cleanup(): void {
    for (const d of readerQueue) {
      d.reject(signal.reason);
    }
    readerQueue.length = 0;
  }
  const iter: AsyncIterableIterator<T> = {
    [Symbol.asyncIterator]() {
      return this;
    },
    async next() {
      if (signal.aborted) {
        return { done: true, value: undefined };
      } else if (bufferedEventQueue.length) {
        const event = bufferedEventQueue.shift()!;
        return { done: false, value: event };
      } else {
        const deferred = Promise.withResolvers<T>();
        readerQueue.push(deferred);
        const value = await deferred.promise;
        return { done: false, value };
      }
    },
    return() {
      abortController.abort();
      cleanup();
      return Promise.resolve({ done: true, value: undefined });
    },
  };
  return iter;
}
