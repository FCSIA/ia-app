/** easeInOutSine: matches GSAP's `sine.inOut` for ambient back-and-forth drift. */
export const EASE_IN_OUT_SINE = 'cubic-bezier(0.37, 0, 0.63, 1)';

export function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

export function randomBetween(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

type AmbientLoop = { keyframes: Keyframe[]; options: KeyframeAnimationOptions };

/**
 * Starts infinite decorative loops with the Web Animations API so the
 * compositor runs them (transform/opacity only) instead of a per-frame GSAP
 * tween competing with slide mounts on the main thread. Skipped entirely under
 * reduced motion; elements keep their static start state. Returns a cleanup
 * that cancels every loop.
 */
export function startAmbientLoops(
  root: HTMLElement | null,
  selector: string,
  build: (element: HTMLElement, index: number) => AmbientLoop,
): () => void {
  if (!root || prefersReducedMotion()) return () => {};
  const animations = Array.from(root.querySelectorAll<HTMLElement>(selector), (element, index) => {
    const { keyframes, options } = build(element, index);
    return element.animate(keyframes, { iterations: Infinity, ...options });
  });
  return () => {
    for (const animation of animations) animation.cancel();
  };
}
