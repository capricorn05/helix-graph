import type { PrimitiveController } from "./core/types.js";

export type ToastPlacement =
  | "top-start"
  | "top-center"
  | "top-end"
  | "bottom-start"
  | "bottom-center"
  | "bottom-end";

export interface ToastOptions {
  placement?: ToastPlacement;
  defaultDuration?: number;
  maxVisible?: number;
}

export interface ToastShowOptions {
  id?: string;
  duration?: number;
  tone?: "info" | "success" | "warning" | "error";
  ariaLive?: "polite" | "assertive";
}

export interface ToastController extends PrimitiveController {
  show(content: string | HTMLElement, options?: ToastShowOptions): string;
  dismiss(id: string): void;
  clear(): void;
  list(): string[];
}

export function createToastController(
  viewportEl: HTMLElement,
  options?: ToastOptions,
): ToastController {
  const placement = options?.placement ?? "bottom-end";
  const defaultDuration = options?.defaultDuration ?? 4000;
  const maxVisible = options?.maxVisible ?? 5;

  const timers = new Map<string, ReturnType<typeof setTimeout>>();
  const toasts = new Map<string, HTMLElement>();

  const applyViewportPlacement = () => {
    viewportEl.setAttribute("data-hx-toast-viewport", "true");
    viewportEl.setAttribute("aria-live", "polite");
    viewportEl.setAttribute("aria-atomic", "false");
    viewportEl.style.position = "fixed";
    viewportEl.style.zIndex = "1100";
    viewportEl.style.display = "flex";
    viewportEl.style.flexDirection = "column";
    viewportEl.style.gap = "8px";
    viewportEl.style.maxWidth = "min(420px, calc(100vw - 32px))";
    viewportEl.style.pointerEvents = "none";

    viewportEl.style.top = "";
    viewportEl.style.bottom = "";
    viewportEl.style.left = "";
    viewportEl.style.right = "";
    viewportEl.style.transform = "";

    if (placement.startsWith("top")) {
      viewportEl.style.top = "16px";
    } else {
      viewportEl.style.bottom = "16px";
    }

    if (placement.endsWith("start")) {
      viewportEl.style.left = "16px";
    } else if (placement.endsWith("end")) {
      viewportEl.style.right = "16px";
    } else {
      viewportEl.style.left = "50%";
      viewportEl.style.transform = "translateX(-50%)";
    }
  };

  const dismiss = (id: string) => {
    const timer = timers.get(id);
    if (timer) {
      clearTimeout(timer);
      timers.delete(id);
    }

    const toastEl = toasts.get(id);
    if (toastEl) {
      toastEl.remove();
      toasts.delete(id);
    }
  };

  const show = (
    content: string | HTMLElement,
    showOptions?: ToastShowOptions,
  ): string => {
    applyViewportPlacement();

    const id =
      showOptions?.id ?? `toast-${Math.random().toString(36).substr(2, 9)}`;
    const duration = showOptions?.duration ?? defaultDuration;

    dismiss(id);

    const toastEl = document.createElement("div");
    toastEl.setAttribute("data-hx-toast-id", id);
    toastEl.setAttribute("data-hx-tone", showOptions?.tone ?? "info");
    toastEl.setAttribute("role", "status");
    toastEl.setAttribute("aria-live", showOptions?.ariaLive ?? "polite");
    toastEl.style.pointerEvents = "auto";
    toastEl.style.padding = "12px 14px";
    toastEl.style.borderRadius = "10px";
    toastEl.style.border = "1px solid rgb(0 0 0 / 0.12)";
    toastEl.style.background = "white";
    toastEl.style.color = "black";
    toastEl.style.boxShadow = "0 10px 30px rgb(0 0 0 / 0.16)";

    if (typeof content === "string") {
      toastEl.textContent = content;
    } else {
      toastEl.appendChild(content);
    }

    viewportEl.appendChild(toastEl);
    toasts.set(id, toastEl);

    while (toasts.size > maxVisible) {
      const oldest = toasts.keys().next().value as string | undefined;
      if (!oldest) {
        break;
      }
      dismiss(oldest);
    }

    if (duration > 0) {
      timers.set(
        id,
        setTimeout(() => {
          dismiss(id);
        }, duration),
      );
    }

    return id;
  };

  const clear = () => {
    Array.from(toasts.keys()).forEach((id) => dismiss(id));
  };

  applyViewportPlacement();

  return {
    show,
    dismiss,
    clear,
    list() {
      return Array.from(toasts.keys());
    },
    destroy() {
      clear();
    },
  };
}
