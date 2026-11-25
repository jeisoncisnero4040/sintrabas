export class InvalidAllyApplication extends Error {}

const applicantRoles = ['facilitador', 'consultor'] as const;
type ApplicantRole = typeof applicantRoles[number];

export function parseAllyApplication(input: Record<string, unknown>) {
  function field(key: string, title: string, max: number, required = false) {
    const value = input[key] ?? '';
    if (typeof value !== 'string' || value.length > max || (required && !value.trim())) {
      throw new InvalidAllyApplication('Revisa el campo «' + title + '».');
    }
    return value.trim();
  }

  function selections(key: string, required = false) {
    const value = input[key] ?? [];
    if (!Array.isArray(value) || value.length > 20 || (required && !value.length)
      || value.some(item => typeof item !== 'string' || !item.trim() || item.length > 80)) {
      throw new InvalidAllyApplication('Revisa los servicios, trámites o tecnologías seleccionados.');
    }
    return [...new Set((value as string[]).map(item => item.trim()))];
  }

  function link(key: string, title: string) {
    const value = field(key, title, 500);
    if (!value) return '';
    const url = URL.parse(value);
    if (!url || !['https:', 'http:'].includes(url.protocol) || url.username || url.password) {
      throw new InvalidAllyApplication('Ingresa un enlace válido en «' + title + '».');
    }
    return url.href;
  }

  const { role, accepted } = input;
  if (!applicantRoles.some(item => item === role)) throw new InvalidAllyApplication('Elige el tipo de postulación.');
  if (accepted !== true) throw new InvalidAllyApplication('Autoriza el uso de tus datos para enviar la postulación.');
  const requestId = field('requestId', 'Identificador de solicitud', 36, true);
  if (!/^[\da-f]{8}(?:-[\da-f]{4}){3}-[\da-f]{12}$/iu.test(requestId)) throw new InvalidAllyApplication('Identificador de solicitud inválido.');
  const email = field('email', 'Correo', 254, true).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(email)) throw new InvalidAllyApplication('Ingresa un correo válido.');
  const fee = field('fee', 'Tarifa en COP', 20).replace(/[.\s]/gu, '');
  if (fee && !/^\d{1,12}$/u.test(fee)) throw new InvalidAllyApplication('Ingresa una tarifa válida en pesos colombianos.');

  const common = {
    name: field('name', 'Nombre completo o razón social', 120, true),
    document: field('document', 'Cédula o NIT', 24),
    email,
    phone: field('phone', 'Celular', 30),
    specialty: field('specialty', 'Profesión o especialidad', 80, true),
    experience: field('experience', 'Años de experiencia', 50, true),
    services: selections('services', true),
    feeCop: fee ? Number(fee) : null,
    accepted,
  };
  const details = role === 'consultor' ? {
    ...common,
    technologies: selections('technologies'),
    portfolio: link('portfolio', 'Portafolio o sitio web'),
    professionalLink: link('professionalLink', 'Perfil profesional'),
    billing: field('billing', 'Cómo cobras', 50, true),
    availability: field('availability', 'Disponibilidad', 50, true),
    project: field('project', 'Proyecto', 1600),
  } : {
    ...common,
    professionalCard: field('professionalCard', 'Tarjeta profesional', 40),
    project: field('project', 'Experiencia relevante', 1600),
  };
  return { requestId, role: role as ApplicantRole, details };
}

export type AllyApplication = ReturnType<typeof parseAllyApplication>;

export interface ApplicationReceipt {
  id: string;
  role: AllyApplication['role'];
  status: 'pendiente_revision';
  createdAt: string;
}
