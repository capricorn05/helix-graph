/**
 * Lazy activation triggers for visibility and idle phases.
 *
 * These small utilities implement the client bootstrap activation modes
 * described in Tech Specs §9.2: visibility-driven and idle-time attachment.
 */

export interface VisibilityTriggerOptions {
  root?: Element | Document | null;
  rootMargin?: string;
  threshold?: number | number[];
  once?: boolean;
}

export interface VisibilityTriggerController {
  observe(element: Element): void;
  unobserve(element: Element): void;
  disconnect(): void;
}

export function createVisibilityTrigger(
  onVisible: (element: Element, entry: IntersectionObserverEntry) => void,
  options?: VisibilityTriggerOptions,
): VisibilityTriggerController {
  const once = options?.once ?? true;

  const observer = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) {
        continue;
      }

      onVisible(entry.target, entry);
      if (once) {
        observer.unobserve(entry.target);
      }
    }
  }, {
    root: options?.root ?? null,
    rootMargin: options?.rootMargin,
    threshold: options?.threshold,
  });

  return {
    observe(element: Element): void {
      observer.observe(element);
    },
    unobserve(element: Element): void {
      observer.unobserve(element);
    },
    disconnect(): void {
      observer.disconnect();
    },
  };
}

export interface IdleTriggerController {
  cancel(): void;
}

export interface IdleTriggerOptions {
  timeout?: number;
}

export function createIdleTrigger(
  callback: (deadline?: IdleDeadline) => void,
  options?: IdleTriggerOptions,
): IdleTriggerController {
  if (typeof requestIdleCallback === "function") {
    const handle = requestIdleCallback(callback, {
      timeout: options?.timeout,
    });
    return {
      cancel(): void {
        cancelIdleCallback(handle);
      },
    };
  }

  const timeoutId = setTimeout(() => callback(undefined), options?.timeout ?? 1);
  return {
    cancel(): void {
      clearTimeout(timeoutId);
    },
  };
}
