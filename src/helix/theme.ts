export type ThemeTokenMap = Record<string, string>;

export interface HelixThemeDefinition {
  id: string;
  light: ThemeTokenMap;
  dark?: ThemeTokenMap;
}

export interface RenderThemeOptions {
  includeColorScheme?: boolean;
  includeHeadlessUi?: boolean;
}

export const helixShadcnTheme: HelixThemeDefinition = {
  id: "helix-shadcn",
  light: {
    background: "0 0% 100%",
    foreground: "222.2 84% 4.9%",
    card: "0 0% 100%",
    "card-foreground": "222.2 84% 4.9%",
    popover: "0 0% 100%",
    "popover-foreground": "222.2 84% 4.9%",
    primary: "221.2 83.2% 53.3%",
    "primary-foreground": "210 40% 98%",
    secondary: "210 40% 96.1%",
    "secondary-foreground": "222.2 47.4% 11.2%",
    muted: "210 40% 96.1%",
    "muted-foreground": "215.4 16.3% 46.9%",
    accent: "210 40% 96.1%",
    "accent-foreground": "222.2 47.4% 11.2%",
    destructive: "0 84.2% 60.2%",
    "destructive-foreground": "210 40% 98%",
    border: "214.3 31.8% 91.4%",
    input: "214.3 31.8% 91.4%",
    ring: "221.2 83.2% 53.3%",
    radius: "0.5rem"
  },
  dark: {
    background: "222.2 84% 4.9%",
    foreground: "210 40% 98%",
    card: "222.2 84% 4.9%",
    "card-foreground": "210 40% 98%",
    popover: "222.2 84% 4.9%",
    "popover-foreground": "210 40% 98%",
    primary: "217.2 91.2% 59.8%",
    "primary-foreground": "222.2 47.4% 11.2%",
    secondary: "217.2 32.6% 17.5%",
    "secondary-foreground": "210 40% 98%",
    muted: "217.2 32.6% 17.5%",
    "muted-foreground": "215 20.2% 65.1%",
    accent: "217.2 32.6% 17.5%",
    "accent-foreground": "210 40% 98%",
    destructive: "0 62.8% 30.6%",
    "destructive-foreground": "210 40% 98%",
    border: "217.2 32.6% 17.5%",
    input: "217.2 32.6% 17.5%",
    ring: "224.3 76.3% 48%",
    radius: "0.5rem"
  }
};

function renderTokenDeclarations(tokens: ThemeTokenMap, indent: string): string {
  return Object.entries(tokens)
    .map(([name, value]) => `${indent}--${name}: ${value};`)
    .join("\n");
}

export function renderThemeTokensCss(
  theme: HelixThemeDefinition = helixShadcnTheme,
  options: Pick<RenderThemeOptions, "includeColorScheme"> = {}
): string {
  const includeColorScheme = options.includeColorScheme ?? true;
  const lightColorScheme = includeColorScheme ? "\n  color-scheme: light;" : "";

  let css = `:root {${lightColorScheme}\n${renderTokenDeclarations(theme.light, "  ")}\n}`;

  if (theme.dark) {
    const darkColorScheme = includeColorScheme ? "\n    color-scheme: dark;" : "";
    css += `\n\n@media (prefers-color-scheme: dark) {\n  :root {${darkColorScheme}\n${renderTokenDeclarations(theme.dark, "    ")}\n  }\n}`;
  }

  return css;
}

export function renderHeadlessUiCss(): string {
  return `* { box-sizing: border-box; }

.hx-btn {
  width: fit-content;
  border: 1px solid hsl(var(--primary));
  border-radius: calc(var(--radius) - 2px);
  background: hsl(var(--primary));
  color: hsl(var(--primary-foreground));
  padding: 0.48rem 0.76rem;
  font-weight: 600;
  cursor: pointer;
  transition: opacity 120ms ease;
}

.hx-btn:hover { opacity: 0.92; }
.hx-btn[disabled] { opacity: 0.45; cursor: not-allowed; }

.hx-btn--secondary {
  border-color: hsl(var(--border));
  background: hsl(var(--secondary));
  color: hsl(var(--secondary-foreground));
}

.hx-btn--ghost {
  border-color: transparent;
  background: transparent;
  color: hsl(var(--foreground));
}

.hx-btn--destructive {
  border-color: hsl(var(--destructive));
  background: hsl(var(--destructive));
  color: hsl(var(--destructive-foreground));
}

.hx-card {
  border: 1px solid hsl(var(--border));
  border-radius: var(--radius);
  background: hsl(var(--card));
  color: hsl(var(--card-foreground));
  padding: 1rem;
}

.hx-card__header { margin-bottom: 0.5rem; }
.hx-card__title { margin: 0; }
.hx-card__description { margin: 0.25rem 0 0; color: hsl(var(--muted-foreground)); }
.hx-card__footer { margin-top: 0.75rem; }

.hx-input {
  width: 100%;
  border: 1px solid hsl(var(--input));
  border-radius: calc(var(--radius) - 2px);
  background: hsl(var(--background));
  color: hsl(var(--foreground));
  padding: 0.48rem 0.62rem;
  outline: none;
}

.hx-input:focus {
  box-shadow: 0 0 0 2px hsl(var(--ring) / 0.25);
  border-color: hsl(var(--ring));
}

.hx-table {
  border-collapse: collapse;
  width: 100%;
  border: 1px solid hsl(var(--border));
  border-radius: var(--radius);
  overflow: hidden;
}

.hx-table th,
.hx-table td {
  border-bottom: 1px solid hsl(var(--border));
  text-align: left;
  padding: 0.55rem;
}

.hx-table th {
  background: hsl(var(--muted));
  color: hsl(var(--muted-foreground));
  font-weight: 600;
}`;
}

export function renderThemeHeadContent(
  theme: HelixThemeDefinition = helixShadcnTheme,
  options: RenderThemeOptions = {}
): string {
  const cssChunks = [
    renderThemeTokensCss(theme, { includeColorScheme: options.includeColorScheme }),
    options.includeHeadlessUi === false ? "" : renderHeadlessUiCss()
  ].filter((chunk) => chunk.length > 0);

  return `<style>\n${cssChunks.join("\n\n")}\n</style>`;
}
