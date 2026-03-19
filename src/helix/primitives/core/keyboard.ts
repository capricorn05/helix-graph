export const KEY = {
  Escape: "Escape",
  Enter: "Enter",
  Space: " ",
  ArrowUp: "ArrowUp",
  ArrowDown: "ArrowDown",
  ArrowLeft: "ArrowLeft",
  ArrowRight: "ArrowRight",
  Home: "Home",
  End: "End",
  Tab: "Tab",
} as const;

export function createKeyboardHandler(
  map: Partial<
    Record<(typeof KEY)[keyof typeof KEY], (e: KeyboardEvent) => void>
  >,
): (e: KeyboardEvent) => void {
  return (e: KeyboardEvent) => {
    const handler = map[e.key as (typeof KEY)[keyof typeof KEY]];
    if (handler) {
      handler(e);
    }
  };
}
