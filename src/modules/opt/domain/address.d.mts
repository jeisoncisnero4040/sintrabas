export function parseOptAddress(input: string): { route: string; cross: string; plate: string } | null;
export function formatOptAddress(route: string, cross: string, plate: string): string;
export function cadastralCodeVariants(code: string): string[];
