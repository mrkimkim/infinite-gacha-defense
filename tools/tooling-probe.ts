// Portable tooling specimen only: no gameplay, DOM, Node APIs, clock, or randomness.
export interface ToolingProbe {
  label: string;
  values: readonly number[];
}

export const toolingProbe = {
  label: "TypeScript 도구 확인",
  values: [1, 2, 3],
} satisfies ToolingProbe;
