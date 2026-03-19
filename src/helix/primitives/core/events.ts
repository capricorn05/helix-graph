export interface EventAdapter {
  on(
    element: EventTarget,
    type: string,
    handler: EventListener,
    options?: AddEventListenerOptions,
  ): () => void; // returns unsubscribe
}

export const defaultDomAdapter: EventAdapter = {
  on(element, type, handler, options) {
    element.addEventListener(type, handler, options);
    return () => element.removeEventListener(type, handler, options);
  },
};
