export interface ClientDomController {
  destroy(): void;
}

export interface DomElementConstructor<TElement extends Element> {
  new (): TElement;
  prototype: TElement;
}

export interface DomTargetScope {
  has(targetId: string): boolean;
  query<TElement extends Element>(
    targetId: string,
    ctor: DomElementConstructor<TElement>,
  ): TElement | null;
}

export type TextValueElement =
  | HTMLInputElement
  | HTMLTextAreaElement
  | HTMLSelectElement;

export interface ListenToTargetOptions<TElement extends Element> {
  root: ParentNode;
  targetId: string;
  type: DomElementConstructor<TElement>;
  event: string;
  listener: (element: TElement, event: Event) => void;
  options?: AddEventListenerOptions;
}

export interface BindTargetTextValueOptions<TElement extends TextValueElement> {
  root: ParentNode;
  targetId: string;
  type: DomElementConstructor<TElement>;
  event?: string;
  onValue: (value: string, element: TElement, event: Event) => void;
  options?: AddEventListenerOptions;
}

export interface BindTargetValueOptions<
  TElement extends TextValueElement,
  TValue,
> {
  root: ParentNode;
  targetId: string;
  type: DomElementConstructor<TElement>;
  event?: string;
  readValue: (element: TElement, event: Event) => TValue;
  onValue: (value: TValue, element: TElement, event: Event) => void;
  options?: AddEventListenerOptions;
}

function targetSelector(targetId: string): string {
  return `[data-hx-id="${targetId}"]`;
}

export function createDomTargetScope(root: ParentNode): DomTargetScope {
  return {
    has(targetId: string): boolean {
      return root.querySelector(targetSelector(targetId)) !== null;
    },
    query<TElement extends Element>(
      targetId: string,
      ctor: DomElementConstructor<TElement>,
    ): TElement | null {
      const element = root.querySelector(targetSelector(targetId));
      return element instanceof ctor ? element : null;
    },
  };
}

export function createEventController(
  target: EventTarget,
  type: string,
  listener: EventListener,
  options?: AddEventListenerOptions,
): ClientDomController {
  target.addEventListener(type, listener, options);
  return {
    destroy() {
      target.removeEventListener(type, listener, options);
    },
  };
}

export function listenToTarget<TElement extends Element>(
  options: ListenToTargetOptions<TElement>,
): ClientDomController | null {
  const scope = createDomTargetScope(options.root);
  const element = scope.query(options.targetId, options.type);
  if (!element) {
    return null;
  }

  return createEventController(
    element,
    options.event,
    (event) => {
      options.listener(element, event);
    },
    options.options,
  );
}

function inferTextValueEvent(element: TextValueElement): string {
  if (element instanceof HTMLSelectElement) {
    return "change";
  }

  if (
    element instanceof HTMLInputElement &&
    (element.type === "checkbox" ||
      element.type === "radio" ||
      element.type === "file")
  ) {
    return "change";
  }

  return "input";
}

export function bindTargetTextValue<TElement extends TextValueElement>(
  options: BindTargetTextValueOptions<TElement>,
): ClientDomController | null {
  const scope = createDomTargetScope(options.root);
  const element = scope.query(options.targetId, options.type);
  if (!element) {
    return null;
  }

  return createEventController(
    element,
    options.event ?? inferTextValueEvent(element),
    (event) => {
      options.onValue(element.value, element, event);
    },
    options.options,
  );
}

/**
 * Binds a target input/select/textarea and emits custom value types.
 * Use this for checkbox/radio/file/select-multiple model bindings.
 */
export function bindTargetValue<TElement extends TextValueElement, TValue>(
  options: BindTargetValueOptions<TElement, TValue>,
): ClientDomController | null {
  const scope = createDomTargetScope(options.root);
  const element = scope.query(options.targetId, options.type);
  if (!element) {
    return null;
  }

  return createEventController(
    element,
    options.event ?? inferTextValueEvent(element),
    (event) => {
      const value = options.readValue(element, event);
      options.onValue(value, element, event);
    },
    options.options,
  );
}

export function readCheckboxChecked(element: HTMLInputElement): boolean {
  return element.checked;
}

export function readRadioGroupValue(
  element: HTMLInputElement,
  root: ParentNode,
): string | null {
  if (!element.name) {
    return element.checked ? element.value : null;
  }

  const radios = root.querySelectorAll('input[type="radio"]');
  for (const node of radios) {
    if (
      node instanceof HTMLInputElement &&
      node.name === element.name &&
      node.checked
    ) {
      return node.value;
    }
  }

  return null;
}

export function readFileList(element: HTMLInputElement): FileList | null {
  return element.files;
}

export function readSelectMultipleValues(element: HTMLSelectElement): string[] {
  if (!element.multiple) {
    return [element.value];
  }

  return Array.from(element.selectedOptions).map((option) => option.value);
}
