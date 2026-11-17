import { afterEach, describe, expect, test, vi } from 'vitest';
import { renderPdfFirstPage, setPdfWorkerSrc } from './pdf-thumbnail';

const pdfjs = vi.hoisted(() => ({
  getDocument: vi.fn(), GlobalWorkerOptions: { workerSrc: '' }, version: 'test',
}));
vi.mock('pdfjs-dist', () => pdfjs);

afterEach(() => { vi.unstubAllGlobals(); vi.clearAllMocks(); });
const file = { arrayBuffer: async () => new ArrayBuffer(0) } as File;
function setup() {
  const task = { promise: Promise.resolve(), cancel: vi.fn() };
  const page = { getViewport: () => ({ width: 100, height: 100 }), render: vi.fn(() => task) };
  const pdf = { getPage: vi.fn(async () => page) };
  const loading = { promise: Promise.resolve(pdf), destroy: vi.fn(async () => {}) };
  const canvas = { width: 0, height: 0, toDataURL: () => 'data:image/png;base64,preview' };
  pdfjs.getDocument.mockReturnValue(loading);
  vi.stubGlobal('document', { createElement: () => canvas });
  return { task, page, pdf, loading };
}

describe('PDF preview resource ownership', () => {
  test('destroys the loading task after successful rendering', async () => {
    const { loading } = setup();
    await expect(renderPdfFirstPage(file, 40)).resolves.toBe('data:image/png;base64,preview');
    expect(loading.destroy).toHaveBeenCalledTimes(1);
  });
  test('destroys a rejected loading task', async () => {
    const { loading } = setup();
    loading.promise = Promise.reject(new Error('Invalid PDF'));
    await expect(renderPdfFirstPage(file, 40)).rejects.toThrow('Invalid PDF');
    expect(loading.destroy).toHaveBeenCalledTimes(1);
  });
  test('cancels a pending render and destroys once when aborted', async () => {
    const { loading, task, page } = setup();
    let cancel!: () => void;
    task.promise = new Promise<void>((_, reject) => { cancel = () => reject(new Error('Render cancelled')); });
    task.cancel.mockImplementation(() => cancel());
    const controller = new AbortController();
    const result = renderPdfFirstPage(file, 40, controller.signal);
    await vi.waitFor(() => expect(page.render).toHaveBeenCalledOnce());
    controller.abort();
    await expect(result).rejects.toThrow('Render cancelled');
    expect(task.cancel).toHaveBeenCalledOnce();
    expect(loading.destroy).toHaveBeenCalledTimes(1);
  });
  test('does not start document loading after an early abort', async () => {
    setup();
    const controller = new AbortController();
    controller.abort();
    await expect(renderPdfFirstPage(file, 40, controller.signal)).rejects.toThrow();
    expect(pdfjs.getDocument).not.toHaveBeenCalled();
  });
  test('destroys an in-progress document load when aborted', async () => {
    const { loading } = setup();
    let cancel!: () => void;
    loading.promise = new Promise((_, reject) => {
      cancel = () => reject(new Error('Loading cancelled'));
    });
    loading.destroy.mockImplementation(async () => cancel());
    const controller = new AbortController();
    const result = renderPdfFirstPage(file, 40, controller.signal);
    await vi.waitFor(() => expect(pdfjs.getDocument).toHaveBeenCalledOnce());
    controller.abort();
    await expect(result).rejects.toThrow('Loading cancelled');
    expect(loading.destroy).toHaveBeenCalledTimes(1);
  });
  test('destroys resources if reading a page fails', async () => {
    const { loading, pdf } = setup();
    pdf.getPage.mockRejectedValue(new Error('Missing page'));
    await expect(renderPdfFirstPage(file, 40)).rejects.toThrow('Missing page');
    expect(loading.destroy).toHaveBeenCalledTimes(1);
  });
  test('allows a self-hosted worker before and after loading', async () => {
    setup();
    setPdfWorkerSrc('/pdf.worker.mjs');
    await renderPdfFirstPage(file, 40);
    expect(pdfjs.GlobalWorkerOptions.workerSrc).toBe('/pdf.worker.mjs');
    setPdfWorkerSrc('/updated.worker.mjs');
    await Promise.resolve();
    expect(pdfjs.GlobalWorkerOptions.workerSrc).toBe('/updated.worker.mjs');
  });
});
