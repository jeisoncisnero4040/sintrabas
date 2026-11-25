export class InvalidDomainName extends Error {}

const extensions = ['com', 'com.co', 'co', 'net'];

export class DomainName {
  private constructor(readonly label: string) {}

  static from(input: string | null) {
    if (!input || input.length > 120 || /[@:/\\]/u.test(input)) throw new InvalidDomainName();
    const label = input.trim().toLowerCase().normalize('NFD')
      .replace(/\p{Diacritic}/gu, '')
      .replace(/\.(com\.co|com|net|co)$/u, '')
      .replace(/\b(?:s\.?a\.?s\.?|ltda)\b/gu, '')
      .replace(/[^a-z0-9]/gu, '');
    if (!label || label.length > 63) throw new InvalidDomainName();
    return new DomainName(label);
  }

  variants() {
    return extensions.map(extension => `${this.label}.${extension}`);
  }
}
