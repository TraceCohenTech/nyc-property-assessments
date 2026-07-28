import codes from "@/db/building_class_codes.json";

type CodesFile = {
  letters: Record<string, string>;
  codes: Record<string, string>;
};

const data = codes as unknown as CodesFile;

/** Human-readable description for a DOF building class code, e.g. "R4" -> "Condominium - ...". */
export function buildingClassDescription(code: string | null | undefined): string | null {
  if (!code) return null;
  const c = code.toUpperCase();
  if (data.codes[c]) return data.codes[c];
  const letter = c[0];
  if (data.letters[letter]) return `${data.letters[letter]} - Type ${c}`;
  return null;
}

export function buildingClassLetterCategory(code: string | null | undefined): string | null {
  if (!code) return null;
  return data.letters[code[0].toUpperCase()] ?? null;
}
