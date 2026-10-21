import { afterEach, describe, expect, test, vi } from 'vitest';
import { observeMedia, subscribePageVisibility } from './use-media-visibility';

afterEach(() => vi.unstubAllGlobals());

describe('shared media visibility observers', () => {
  test('separates preloading from playback, shares observers, and releases subscriptions', () => {
    const instances: Array<{ callback: IntersectionObserverCallback; rootMargin: string; observe: ReturnType<typeof vi.fn>; unobserve: ReturnType<typeof vi.fn>; disconnect: ReturnType<typeof vi.fn> }> = [];
    vi.stubGlobal('IntersectionObserver', class {
      observe = vi.fn(); unobserve = vi.fn(); disconnect = vi.fn();
      constructor(public callback: IntersectionObserverCallback, options: IntersectionObserverInit) {
        instances.push({ ...this, callback, rootMargin: options.rootMargin! });
      }
    });
    const first = {} as Element;
    const second = {} as Element;
    const changed = vi.fn();
    const stopFirst = observeMedia(first, changed);
    const stopSecond = observeMedia(second, vi.fn());
    expect(instances.map((instance) => instance.rootMargin)).toEqual(['0px', '240px']);
    const emit = (index: number, intersecting: boolean, ratio = intersecting ? 1 : 0) => instances[index].callback([
      { target: first, isIntersecting: intersecting, intersectionRatio: ratio } as IntersectionObserverEntry,
    ], {} as IntersectionObserver);
    emit(1, true);
    expect(changed).toHaveBeenLastCalledWith({ nearby: true, visible: false });
    emit(0, true);
    expect(changed).toHaveBeenLastCalledWith({ nearby: true, visible: true });
    emit(0, true, 0);
    expect(changed).toHaveBeenLastCalledWith({ nearby: true, visible: false });
    emit(1, false);
    expect(changed).toHaveBeenLastCalledWith({ nearby: false, visible: false });
    stopFirst();
    const count = changed.mock.calls.length;
    emit(0, true);
    expect(changed).toHaveBeenCalledTimes(count);
    expect(instances[0].disconnect).not.toHaveBeenCalled();
    stopSecond();
    expect(instances[0].disconnect).toHaveBeenCalledOnce();
    expect(instances[1].disconnect).toHaveBeenCalledOnce();
  });

  test('uses one document visibility listener regardless of GIF count', () => {
    const document = { addEventListener: vi.fn(), removeEventListener: vi.fn() };
    vi.stubGlobal('document', document);
    const first = vi.fn(); const second = vi.fn();
    const stopFirst = subscribePageVisibility(first);
    const stopSecond = subscribePageVisibility(second);
    expect(document.addEventListener).toHaveBeenCalledTimes(1);
    document.addEventListener.mock.calls[0][1]();
    expect(first).toHaveBeenCalledOnce(); expect(second).toHaveBeenCalledOnce();
    stopFirst();
    expect(document.removeEventListener).not.toHaveBeenCalled();
    stopSecond();
    expect(document.removeEventListener).toHaveBeenCalledOnce();
  });

  test('keeps media usable in browsers without IntersectionObserver', () => {
    vi.stubGlobal('IntersectionObserver', undefined);
    const changed = vi.fn();
    observeMedia({} as Element, changed)();
    expect(changed).toHaveBeenCalledWith({ visible: true, nearby: true });
  });
});
