import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { createWorker } = vi.hoisted(() => ({ createWorker: vi.fn() }));
vi.mock("tesseract.js", () => ({ createWorker }));

const tsv = [
  "level\tpage_num\tblock_num\tpar_num\tline_num\tword_num\tleft\ttop\twidth\theight\tconf\ttext",
  "5\t1\t1\t1\t1\t1\t20\t22\t10\t20\t96\t1",
  "5\t1\t1\t1\t1\t2\t200\t20\t100\t20\t96\tChemistry",
].join("\n");

function mockWorker() {
  return {
    recognize: vi.fn().mockResolvedValue({ data: { text: "1 Chemistry", tsv } }),
    setParameters: vi.fn().mockResolvedValue(undefined),
    terminate: vi.fn().mockResolvedValue(undefined),
    worker: { addEventListener: vi.fn() },
  };
}

describe("browser schedule reader lifecycle", () => {
  const file = new File(["test"], "schedule.png", { type: "image/png" });

  beforeEach(() => {
    vi.resetModules();
    vi.useFakeTimers();
    createWorker.mockReset();
    vi.stubGlobal("createImageBitmap", vi.fn(async () => ({
      width: 880, height: 520, close: vi.fn(),
    })));
    vi.stubGlobal("document", {
      createElement: () => ({
        width: 0, height: 0,
        getContext: () => ({ fillRect: vi.fn(), drawImage: vi.fn() }),
      }),
    });
  });

  afterEach(async () => {
    await vi.runOnlyPendingTimersAsync();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("serves every OCR asset locally, reuses the worker, and releases idle memory", async () => {
    const worker = mockWorker();
    createWorker.mockResolvedValue(worker);
    const { readScheduleImageLocally } = await import("./schedule-ocr-local");
    await readScheduleImageLocally(file, vi.fn());
    await readScheduleImageLocally(file, vi.fn());
    expect(createWorker).toHaveBeenCalledTimes(1);
    expect(createWorker).toHaveBeenCalledWith("eng", 1, expect.objectContaining({
      workerPath: "/schedule-ocr-assets/worker.min.js",
      corePath: "/schedule-ocr-assets",
      langPath: "/schedule-ocr-assets",
      workerBlobURL: false,
    }));
    expect(worker.terminate).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(30_000);
    expect(worker.terminate).toHaveBeenCalledTimes(1);
    await readScheduleImageLocally(file, vi.fn());
    expect(createWorker).toHaveBeenCalledTimes(2);
  });

  it("discards a failed worker and allows the next scan to retry", async () => {
    const broken = mockWorker();
    broken.recognize.mockRejectedValue(new Error("internal worker failure"));
    createWorker.mockResolvedValueOnce(broken).mockResolvedValue(mockWorker());
    const { readScheduleImageLocally } = await import("./schedule-ocr-local");
    await expect(readScheduleImageLocally(file, vi.fn())).rejects.toThrow("Try again");
    expect(broken.terminate).toHaveBeenCalledTimes(1);
    await expect(readScheduleImageLocally(file, vi.fn())).resolves.toHaveProperty("lines");
    expect(createWorker).toHaveBeenCalledTimes(2);
  });

  it("reports language initialization failures even when createWorker stays pending", async () => {
    createWorker.mockImplementation((_language, _engine, options) => {
      options.errorHandler("language download failed");
      return new Promise(() => {});
    });
    const { readScheduleImageLocally } = await import("./schedule-ocr-local");
    await expect(readScheduleImageLocally(file, vi.fn())).rejects.toThrow("check your connection");
  });

  it("serializes scans so their recognition parameters cannot interfere", async () => {
    const worker = mockWorker();
    let active = 0;
    let peak = 0;
    worker.recognize.mockImplementation(async () => {
      active += 1;
      peak = Math.max(peak, active);
      await Promise.resolve();
      active -= 1;
      return { data: { text: "1 Chemistry", tsv } };
    });
    createWorker.mockResolvedValue(worker);
    const { readScheduleImageLocally } = await import("./schedule-ocr-local");
    await Promise.all([
      readScheduleImageLocally(file, vi.fn()),
      readScheduleImageLocally(file, vi.fn()),
    ]);
    expect(peak).toBe(1);
    expect(createWorker).toHaveBeenCalledTimes(1);
  });

  it("ends a hung scan and lets a subsequent scan start with a fresh worker", async () => {
    const hung = mockWorker();
    hung.recognize.mockImplementation(() => new Promise(() => {}));
    createWorker.mockResolvedValueOnce(hung).mockResolvedValue(mockWorker());
    const { readScheduleImageLocally } = await import("./schedule-ocr-local");
    const rejected = expect(readScheduleImageLocally(file, vi.fn())).rejects.toThrow("Try again");
    await vi.advanceTimersByTimeAsync(120_000);
    await rejected;
    expect(hung.terminate).toHaveBeenCalledTimes(1);
    await expect(readScheduleImageLocally(file, vi.fn())).resolves.toHaveProperty("lines");
  });
});
