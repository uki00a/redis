import {
  createTypedEventTarget,
  dispatchEvent,
  on,
} from "./typed_event_target.ts";
import {
  assert,
  assertEquals,
  assertStrictEquals,
} from "../deps/std/assert.ts";

Deno.test({
  name: "on",
  permissions: "none",
  fn: async (t) => {
    await t.step("implements [Symbol.asyncIterator]", async () => {
      const eventType = "foo";
      const target = createTypedEventTarget<Record<"foo", number>>();
      const ac = new AbortController();
      const iter = on(target, eventType, { signal: ac.signal });
      const events: Array<Event> = [];
      const promise = (async () => {
        for await (const event of iter) {
          assertStrictEquals(event.type, eventType);
          events.push(event);
          if (events.length > 2) {
            ac.abort();
          }
        }
      })();
      dispatchEvent(target, eventType, 123);
      dispatchEvent(
        target,
        // @ts-expect-error -- Intentionally triggering an invalid event.
        eventType + "bar",
        undefined,
      );
      dispatchEvent(target, eventType, 123);
      dispatchEvent(target, eventType, 123);
      await promise;
      assertEquals(await iter.next(), { done: true, value: undefined });
      assertStrictEquals(events.length, 3);
    });

    await t.step("implements Symbol.asyncIterator#return()", async () => {
      const eventType = "bar";
      const target = createTypedEventTarget<Record<"bar", number>>();
      const ac = new AbortController();
      const iter = on(target, eventType, { signal: ac.signal });

      dispatchEvent(target, eventType, 45);
      const result = await iter.next();
      assertStrictEquals(result.done, false);
      assertStrictEquals(result.value.type, eventType);

      assert(iter.return != null);
      iter.return?.();

      assertEquals(await iter.next(), { done: true, value: undefined });
      dispatchEvent(target, eventType, 67);
      assertEquals(await iter.next(), { done: true, value: undefined });
    });
  },
});
