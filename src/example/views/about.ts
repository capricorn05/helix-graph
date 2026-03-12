import { renderAboutCompiledView } from "./compiled/about.compiled.js";

export function renderAboutPage(): string {
  return renderAboutCompiledView({});
}
