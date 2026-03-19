import type { PrimitivePlacement } from "./types.js";

export interface PositionResult {
  top: number;
  left: number;
  /** The placement that was actually used (may differ from requested if flipped). */
  placementUsed: PrimitivePlacement;
}

export interface PositionOptions {
  /** Preferred placement. Defaults to "bottom-start". */
  placement?: PrimitivePlacement;
  /** Gap between anchor and floating element in pixels. Defaults to 8. */
  offset?: number;
  /**
   * When true (default), auto-flips to the opposite side when the preferred side
   * does not have enough viewport space. Pass false to disable.
   */
  flip?: boolean;
  /**
   * Minimum clearance (px) from each viewport edge before clamping/flipping applies.
   * Defaults to 8.
   */
  viewportPadding?: number;
}

/** Opposite placement for each base side (used by flip logic). */
const FLIP_SIDE: Record<string, string> = {
  top: "bottom",
  bottom: "top",
  left: "right",
  right: "left",
};

/** Resolve the base side of a placement string. */
function baseSide(p: PrimitivePlacement): "top" | "bottom" | "left" | "right" {
  if (p.startsWith("top")) return "top";
  if (p.startsWith("bottom")) return "bottom";
  if (p === "left") return "left";
  return "right";
}

/** Build the flipped placement by swapping the base side. */
function flipPlacement(p: PrimitivePlacement): PrimitivePlacement {
  const side = baseSide(p);
  const suffix = p.slice(side.length); // e.g. "-start", "-end", ""
  return `${FLIP_SIDE[side]}${suffix}` as PrimitivePlacement;
}

/**
 * Compute the top/left for a floating element relative to an anchor,
 * using absolute page coordinates. Respects viewport bounds and optionally
 * flips to the opposite side when the preferred side is clipped.
 */
export function computePosition(
  anchor: HTMLElement,
  floating: HTMLElement,
  options?: PositionOptions,
): PositionResult {
  let placement = options?.placement ?? "bottom-start";
  const offset = options?.offset ?? 8;
  const shouldFlip = options?.flip !== false;
  const vp = options?.viewportPadding ?? 8;

  const anchorRect = anchor.getBoundingClientRect();
  const floatingRect = floating.getBoundingClientRect();

  const scrollX = window.scrollX || 0;
  const scrollY = window.scrollY || 0;
  const vpWidth = window.innerWidth;
  const vpHeight = window.innerHeight;

  const compute = (p: PrimitivePlacement): { top: number; left: number } => {
    let top = 0;
    let left = 0;
    const side = baseSide(p);

    // Vertical
    if (side === "top") {
      top = anchorRect.top + scrollY - floatingRect.height - offset;
    } else if (side === "bottom") {
      top = anchorRect.bottom + scrollY + offset;
    } else {
      // left / right: centre vertically on anchor
      top =
        anchorRect.top +
        scrollY +
        anchorRect.height / 2 -
        floatingRect.height / 2;
    }

    // Horizontal
    if (p.includes("-start")) {
      left = anchorRect.left + scrollX;
    } else if (p.includes("-end")) {
      left = anchorRect.right + scrollX - floatingRect.width;
    } else if (side === "left") {
      left = anchorRect.left + scrollX - floatingRect.width - offset;
    } else if (side === "right") {
      left = anchorRect.right + scrollX + offset;
    } else {
      // centre horizontally on anchor
      left =
        anchorRect.left +
        scrollX +
        anchorRect.width / 2 -
        floatingRect.width / 2;
    }

    return { top, left };
  };

  /** Check whether the computed position clips against the viewport on the
   * relevant axis for the placement's base side. */
  const isClipped = (
    p: PrimitivePlacement,
    pos: { top: number; left: number },
  ): boolean => {
    const side = baseSide(p);
    const relTop = pos.top - scrollY;
    const relLeft = pos.left - scrollX;

    if (side === "top") {
      return relTop < vp;
    }
    if (side === "bottom") {
      return relTop + floatingRect.height > vpHeight - vp;
    }
    if (side === "left") {
      return relLeft < vp;
    }
    // right
    return relLeft + floatingRect.width > vpWidth - vp;
  };

  let pos = compute(placement);

  if (shouldFlip && isClipped(placement, pos)) {
    const flipped = flipPlacement(placement);
    const flippedPos = compute(flipped);
    // Only use the flipped position if it is *less* clipped than the original
    if (!isClipped(flipped, flippedPos)) {
      placement = flipped;
      pos = flippedPos;
    }
  }

  // Viewport clamping — keep the floating element inside the visible area
  const viewportTop = scrollY + vp;
  const viewportLeft = scrollX + vp;
  const viewportBottom = scrollY + vpHeight - vp - floatingRect.height;
  const viewportRight = scrollX + vpWidth - vp - floatingRect.width;

  pos.top = Math.max(viewportTop, Math.min(viewportBottom, pos.top));
  pos.left = Math.max(viewportLeft, Math.min(viewportRight, pos.left));

  return { ...pos, placementUsed: placement };
}

/**
 * Apply a computed position to a floating element.
 * Uses `style.setProperty` (consistent with PatchRuntime setStyle ops now that
 * `top` and `left` are included in the STYLE_WHITELIST).
 */
export function applyPosition(
  floating: HTMLElement,
  pos: PositionResult,
): void {
  floating.style.setProperty("top", `${pos.top}px`);
  floating.style.setProperty("left", `${pos.left}px`);
  floating.style.setProperty("position", "absolute");
}
