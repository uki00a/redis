import { assert, assertEquals } from "../../deps/std/assert.ts";
import type { IsExact } from "../../deps/std/testing.ts";
import {
  afterAll,
  assertType,
  beforeAll,
  beforeEach,
  describe,
  it,
} from "../../deps/std/testing.ts";
import type { Connector, TestServer } from "../test_util.ts";
import type { Redis } from "../../mod.ts";

export function zsetTests(
  connect: Connector,
  getServer: () => TestServer,
): void {
  let client!: Redis;
  beforeAll(async () => {
    const server = getServer();
    client = await connect({ hostname: "127.0.0.1", port: server.port });
  });

  afterAll(() => client.close());

  beforeEach(async () => {
    await client.flushdb();
  });

  it("bzpopmin", async () => {
    await client.zadd("key", { "1": 1, "2": 2 });
    assertEquals(await client.bzpopmin(1, "key"), ["key", "1", "1"]);
  });

  it("bzpopmin returns null on timeout", async () => {
    const arr = await client.bzpopmin(1, "key");
    assertEquals(arr, null);
  });

  it("bzpopmax", async () => {
    await client.zadd("key", { "1": 1, "2": 2 });
    assertEquals(await client.bzpopmax(1, "key"), ["key", "2", "2"]);
  });

  it("bzpopmax returns null on timeout", async () => {
    const arr = await client.bzpopmax(1, "key");
    assertEquals(arr, null);
  });

  describe("zadd", () => {
    it("adds specified members to a sorted set", async () => {
      const v = await client.zadd("key", { "1": 1, "2": 2 });
      assertEquals(v, 2);

      const v2 = await client.zadd("key", 3, "3");
      assertEquals(v2, 1);

      const v3 = await client.zadd("key", [
        [4, "4"],
        [5, "5"],
      ]);
      assertEquals(
        v3,
        2,
      );
      assertType<IsExact<typeof v3, number>>(true);
    });

    it("supports `NX` and `XX`", async () => {
      const v = await client.zadd("zaddWithNXOrXX", 1, "1", { nx: true });
      assertEquals(v, 1);
      assertType<IsExact<typeof v, number | null>>(true);

      const v2 = await client.zadd("zaddWithNXOrXX", 2, "1", { mode: "NX" });
      assertEquals(v2, 0); // NOTE: In RESP3, this seems to be `null`
      assertType<IsExact<typeof v2, number | null>>(true);

      const v3 = await client.zadd("zaddWithNXOrXX", 3, "1", { xx: true });
      assertEquals(v3, 1);
      assertType<IsExact<typeof v3, number | null>>(true);

      const v4 = await client.zadd("zaddWithNXOrXX", [[1, "2"]], {
        mode: "NX",
      });
      assertEquals(v4, 0); // NOTE: In RESP3, this seems to be `null`
      assertType<IsExact<typeof v4, number | null>>(true);
    });

    it("supports `CH`", async () => {
      assertEquals(await client.zadd("keyWithCH", [[1, "foo"], [2, "bar"]]), 2);
      const v = await client.zadd(
        "keyWithCH",
        { "foo": 1, "bar": 3, "baz": 4 },
        { ch: true },
      );
      assertEquals(
        v,
        2,
      );
      assertType<IsExact<typeof v, number>>(true);
    });
  });
  it("zaddIncr", async () => {
    await client.zadd("key", 1, "a");
    await client.zaddIncr("key", 2, "a");
    assertEquals(await client.zscore("key", "a"), "3");
  });

  it("zaddIncrWithMode", async () => {
    assertEquals(
      await client.zaddIncr("key", 1, "one", { mode: "XX" }),
      null,
      "no member should be added",
    );
    assertEquals(
      await client.zaddIncr("key", 2, "two", { mode: "NX" }),
      "2",
    );
  });

  it("zaddIncrWithCH", async () => {
    await client.zadd("key", 1, "foo");
    assertEquals(
      await client.zaddIncr("key", 3, "foo", { ch: true }),
      "4",
      "`ZADD` with `INCR` should return the new score of member",
    );
    assertEquals(await client.zscore("key", "foo"), "4");
  });

  it("zcount", async () => {
    await client.zadd("key", { "1": 1, "2": 2 });
    assertEquals(await client.zcount("key", 0, 1), 1);
  });

  it("zincrby", async () => {
    await client.zadd("key", { "1": 1, "2": 2 });
    const v = await client.zincrby("key", 2.0, "1");
    assert(v != null);
    assert(parseFloat(v) - 3.0 < Number.EPSILON);
  });

  it("zinterstore", async () => {
    await client.zadd("key", { "1": 1, "2": 2 });
    await client.zadd("key2", { "1": 1, "3": 3 });
    assertEquals(await client.zinterstore("dest", ["key", "key2"]), 1);
  });

  it("zinter", async () => {
    await client.zadd("key", { "1": 1, "2": 2 });
    await client.zadd("key2", { "1": 1, "3": 3 });
    assertEquals(await client.zinter(["key", "key2"]), ["1"]);
    assertEquals(await client.zinter([["key", 2], ["key2", 3]]), ["1"]);
    assertEquals(
      await client.zinter([
        ["key", 2],
        ["key2", 3],
      ], { aggregate: "MIN" }),
      ["1"],
    );
    assertEquals(
      await client.zinter(["key", "key2"], {
        withScore: true,
      }),
      ["1", "2"],
    );
  });

  it("zlexcount", async () => {
    await client.zadd("key2", { "1": 1, "2": 2 });
    assertEquals(await client.zlexcount("key", "-", "(2"), 0);
  });

  it("zpopmax", async () => {
    await client.zadd("key", { one: 1, two: 2 });
    assertEquals(await client.zpopmax("key", 1), ["two", "2"]);
  });

  it("zrange", async () => {
    await client.zadd("key", { one: 1, two: 2 });
    assertEquals(await client.zrange("key", 1, 2), ["two"]);
  });

  it("zrangebylex", async () => {
    await client.zadd("key", { one: 1, two: 2 });
    assertEquals(await client.zrangebylex("key", "-", "(2"), []);
  });

  it("zrevrangebylex", async () => {
    await client.zadd("key", { one: 1, two: 2 });
    assertEquals(await client.zrevrangebylex("key", "(2", "-"), []);
  });

  it("zrangebyscore", async () => {
    await client.zadd("key", { one: 1, two: 2 });
    assertEquals(await client.zrangebyscore("key", "1", "2"), ["one", "two"]);
  });

  it("zrank", async () => {
    await client.zadd("key", { one: 1, two: 2 });
    assertEquals(await client.zrank("key", "two"), 1);
  });

  it("zrem", async () => {
    client.zadd("key", { one: 1, two: 2 });
    assertEquals(await client.zrem("key", "one"), 1);
  });

  it("zremrangebylex", async () => {
    client.zadd("key", { one: 1, two: 2 });
    assertEquals(await client.zremrangebylex("key", "[one", "[two"), 2);
  });

  it("zremrangebyrank", async () => {
    client.zadd("key", { one: 1, two: 2 });
    assertEquals(await client.zremrangebyrank("key", 1, 2), 1);
  });

  it("zremrangebyscore", async () => {
    client.zadd("key", { one: 1, two: 2 });
    assertEquals(await client.zremrangebyscore("key", 1, 2), 2);
  });

  it("zrevrange", async () => {
    client.zadd("key", { one: 1, two: 2 });
    assertEquals(await client.zrevrange("key", 1, 2), ["one"]);
  });

  it("zrevrangebyscore", async () => {
    client.zadd("key", { one: 1, two: 2 });
    assertEquals(await client.zrevrangebyscore("key", 2, 1), ["two", "one"]);
  });

  it("zrevrank", async () => {
    client.zadd("key", { one: 1, two: 2 });
    assertEquals(await client.zrevrank("key", "one"), 1);
  });

  it("zscore", async () => {
    client.zadd("key", { one: 1, two: 2 });
    assertEquals(await client.zscore("key", "one"), "1");
  });

  it("zunionstore", async () => {
    client.zadd("key", { one: 1, two: 2 });
    client.zadd("key2", { one: 1, three: 3 });
    assertEquals(await client.zunionstore("dest", ["key", "key2"]), 3);
  });

  it("zscan", async () => {
    client.zadd("key", { one: 1, two: 2 });
    assertEquals(await client.zscan("key", 1), ["0", ["one", "1", "two", "2"]]);
  });

  it("testZrange", async function testZrange() {
    client.zadd("zrange", 1, "one");
    client.zadd("zrange", 2, "two");
    client.zadd("zrange", 3, "three");
    const v = await client.zrange("zrange", 0, 1);
    assertEquals(v, ["one", "two"]);
  });

  it("testZrangeWithScores", async function testZrangeWithScores() {
    client.zadd("zrangeWithScores", 1, "one");
    client.zadd("zrangeWithScores", 2, "two");
    client.zadd("zrangeWithScores", 3, "three");
    const v = await client.zrange("zrangeWithScores", 0, 1, {
      withScore: true,
    });
    assertEquals(v, ["one", "1", "two", "2"]);
  });

  it("testZrevrange", async function testZrevrange() {
    client.zadd("zrevrange", 1, "one");
    client.zadd("zrevrange", 2, "two");
    client.zadd("zrevrange", 3, "three");
    const v = await client.zrevrange("zrevrange", 0, 1);
    assertEquals(v, ["three", "two"]);
  });

  it(
    "testZrevrangeWithScores",
    async function testZrevrangeWithScores() {
      client.zadd("zrevrangeWithScores", 1, "one");
      client.zadd("zrevrangeWithScores", 2, "two");
      client.zadd("zrevrangeWithScores", 3, "three");
      const v = await client.zrevrange("zrevrangeWithScores", 0, 1, {
        withScore: true,
      });
      assertEquals(v, ["three", "3", "two", "2"]);
    },
  );

  it("testZrangebyscore", async function testZrangebyscore() {
    client.zadd("zrangebyscore", 2, "m1");
    client.zadd("zrangebyscore", 5, "m2");
    client.zadd("zrangebyscore", 8, "m3");
    client.zadd("zrangebyscore", 10, "m4");
    const v = await client.zrangebyscore("zrangebyscore", 3, 9);
    assertEquals(v, ["m2", "m3"]);
  });

  it(
    "testZrangebyscoreWithScores",
    async function testZrangebyscoreWithScores() {
      client.zadd("zrangebyscoreWithScores", 2, "m1");
      client.zadd("zrangebyscoreWithScores", 5, "m2");
      client.zadd("zrangebyscoreWithScores", 8, "m3");
      client.zadd("zrangebyscoreWithScores", 10, "m4");
      const v = await client.zrangebyscore("zrangebyscoreWithScores", 3, 9, {
        withScore: true,
      });
      assertEquals(v, ["m2", "5", "m3", "8"]);
    },
  );

  it("testZrevrangebyscore", async function testZrevrangebyscore() {
    client.zadd("zrevrangebyscore", 2, "m1");
    client.zadd("zrevrangebyscore", 5, "m2");
    client.zadd("zrevrangebyscore", 8, "m3");
    client.zadd("zrevrangebyscore", 10, "m4");
    const v = await client.zrevrangebyscore("zrevrangebyscore", 9, 4);
    assertEquals(v, ["m3", "m2"]);
  });

  it("testZrevrangebyscore", async function testZrevrangebyscore() {
    client.zadd("zrevrangebyscoreWithScores", 2, "m1");
    client.zadd("zrevrangebyscoreWithScores", 5, "m2");
    client.zadd("zrevrangebyscoreWithScores", 8, "m3");
    client.zadd("zrevrangebyscoreWithScores", 10, "m4");
    const v = await client.zrevrangebyscore(
      "zrevrangebyscoreWithScores",
      9,
      4,
      {
        withScore: true,
      },
    );
    assertEquals(v, ["m3", "8", "m2", "5"]);
  });
}
