/**
 * Tests for the retry helper. Sleep is injected so no real timers are used and
 * the tests stay fast and deterministic.
 */
import { attesaBackoff, conRetry } from "../retry";

const noSleep = () => Promise.resolve();
const erroreDiRete = () => new TypeError("Network request failed");
const erroreDefinitivo = () => ({ code: "23505", message: "duplicate key" });

describe("attesaBackoff", () => {
  it("doubles each attempt", () => {
    expect(attesaBackoff(1, 500)).toBe(500);
    expect(attesaBackoff(2, 500)).toBe(1000);
    expect(attesaBackoff(3, 500)).toBe(2000);
  });

  it("caps at the maximum", () => {
    expect(attesaBackoff(10, 500, 4000)).toBe(4000);
  });
});

describe("conRetry", () => {
  it("returns the value without retrying when the action succeeds", async () => {
    const azione = jest.fn().mockResolvedValue("ok");
    await expect(conRetry(azione, { sleep: noSleep })).resolves.toBe("ok");
    expect(azione).toHaveBeenCalledTimes(1);
  });

  it("retries a network error and succeeds on a later attempt", async () => {
    const azione = jest
      .fn()
      .mockRejectedValueOnce(erroreDiRete())
      .mockResolvedValue("ok");
    await expect(conRetry(azione, { sleep: noSleep })).resolves.toBe("ok");
    expect(azione).toHaveBeenCalledTimes(2);
  });

  it("gives up after the configured number of attempts", async () => {
    const azione = jest.fn().mockRejectedValue(erroreDiRete());
    await expect(conRetry(azione, { tentativi: 3, sleep: noSleep })).rejects.toThrow(
      "Network request failed"
    );
    expect(azione).toHaveBeenCalledTimes(3);
  });

  it("does NOT retry a non-transient error", async () => {
    const azione = jest.fn().mockRejectedValue(erroreDefinitivo());
    await expect(conRetry(azione, { sleep: noSleep })).rejects.toMatchObject({
      code: "23505",
    });
    expect(azione).toHaveBeenCalledTimes(1);
  });

  it("rethrows the original error, so callers can still translate it", async () => {
    const originale = erroreDiRete();
    const azione = jest.fn().mockRejectedValue(originale);
    await expect(conRetry(azione, { tentativi: 2, sleep: noSleep })).rejects.toBe(originale);
  });

  it("waits with increasing backoff between retries", async () => {
    const attese: number[] = [];
    const sleep = (ms: number) => {
      attese.push(ms);
      return Promise.resolve();
    };
    const azione = jest.fn().mockRejectedValue(erroreDiRete());
    await expect(
      conRetry(azione, { tentativi: 3, attesaInizialeMs: 100, sleep })
    ).rejects.toBeDefined();
    // Two waits for three attempts, doubling.
    expect(attese).toEqual([100, 200]);
  });

  it("notifies the caller before each retry", async () => {
    const onRitento = jest.fn();
    const azione = jest.fn().mockRejectedValueOnce(erroreDiRete()).mockResolvedValue("ok");
    await conRetry(azione, { sleep: noSleep, onRitento });
    expect(onRitento).toHaveBeenCalledTimes(1);
    expect(onRitento).toHaveBeenCalledWith(1, expect.any(TypeError));
  });

  it("does not sleep when the first attempt succeeds", async () => {
    const sleep = jest.fn().mockResolvedValue(undefined);
    await conRetry(() => Promise.resolve("ok"), { sleep });
    expect(sleep).not.toHaveBeenCalled();
  });
});
