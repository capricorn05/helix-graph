import ts from "typescript";

export function toPascalCase(value: string): string {
  return value
    .split(/[-_]/g)
    .filter(Boolean)
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join("");
}

export function toCamelCase(value: string): string {
  const pascal = toPascalCase(value);
  return pascal.length > 0 ? pascal[0].toLowerCase() + pascal.slice(1) : "";
}

export function getTypeScriptScriptKind(filePath: string): ts.ScriptKind {
  return filePath.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
}

export function parseTypeScriptSourceFile(
  filePath: string,
  content: string,
): ts.SourceFile {
  return ts.createSourceFile(
    filePath,
    content,
    ts.ScriptTarget.Latest,
    true,
    getTypeScriptScriptKind(filePath),
  );
}
