import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

const apiPath = '/api/v1/auth';
const name = 'Cuenta de prueba Sin Trabas';
const consent = { terms: true, data: true, marketing: false, version: '2026-11' };

function newAccount() {
  return {
    name,
    email: `prueba-${randomUUID()}@example.invalid`,
    password: randomUUID(),
    consent,
  };
}

function readCookies(response) {
  return response.headers.getSetCookie().map((header) => {
    const [pair, ...parts] = header.split(';').map((part) => part.trim());
    const separator = pair.indexOf('=');
    assert(separator > 0, 'La cabecera Set-Cookie debe incluir nombre y valor');

    const attributes = new Map(parts.map((part) => {
      const [attribute, value] = part.split('=');
      return [attribute.toLowerCase(), value];
    }));

    return { name: pair.slice(0, separator), value: pair.slice(separator + 1), pair, attributes };
  });
}

function getSessionCookie(response, target) {
  const cookie = readCookies(response).find(({ attributes }) => attributes.has('httponly'));
  assert(cookie?.value, 'La sesión debe emitir una cookie HttpOnly con un valor');
  assert.match(cookie.attributes.get('samesite') ?? '', /^(lax|strict)$/i);
  if (target.protocol === 'https:') {
    assert(cookie.attributes.has('secure'), 'La cookie de sesión sobre HTTPS debe ser Secure');
  }
  return cookie;
}

function checkExpiredCookie(response, sessionCookie) {
  const cookie = readCookies(response).find(({ name }) => name === sessionCookie.name);
  assert(cookie, 'Cerrar sesión debe emitir la cookie de sesión con fecha vencida');
  assert.equal(cookie.attributes.get('path'), sessionCookie.attributes.get('path'));

  const expiry = Date.parse(cookie.attributes.get('expires') ?? '');
  assert(cookie.attributes.get('max-age') === '0' || expiry <= Date.now(), 'La cookie debe quedar vencida');
}

function checkUser(result, account) {
  const user = result.body?.data?.user;
  assert(user?.id !== undefined && user.id !== null && user.id !== '', 'La API debe devolver el ID de usuario');
  assert.equal(user.name, account.name);
  assert.equal(user.email, account.email);
  assert(!Object.hasOwn(user, 'password'), 'La API debe excluir la contraseña de la respuesta');
  assert(!Object.hasOwn(user, 'passwordHash'), 'La API debe excluir el hash de la contraseña de la respuesta');
  return user.id;
}

async function expectError(request, status, code) {
  const result = await checkStatus(request, status);
  const error = result.body?.error;
  assert.equal(error?.code, code, 'La API debe devolver el código de error esperado');
  assert(typeof error?.message === 'string' && error.message.length > 0, 'La API debe devolver un mensaje de error');
  return error;
}

async function checkStatus(request, expected) {
  const { response, description } = await request;
  assert.equal(response.status, expected, `${description}: se esperaba HTTP ${expected}, llegó HTTP ${response.status}`);
  assert.match(response.headers.get('content-type') ?? '', /^application\/json\b/i, `${description}: se esperaba JSON`);
  return { response, body: await response.json() };
}

async function run() {
  const target = new URL(process.argv[2] ?? 'http://localhost:3000');
  assert(['http:', 'https:'].includes(target.protocol), 'Indica una URL HTTP o HTTPS');
  const account = newAccount();
  const credentials = { email: account.email, password: account.password };

  async function request(endpoint, { method = 'GET', payload, cookie, origin = target.origin } = {}) {
    const headers = new Headers({ Accept: 'application/json' });
    if (method !== 'GET') headers.set('Origin', origin);
    if (cookie) headers.set('Cookie', cookie.pair);
    if (payload) headers.set('Content-Type', 'application/json');

    const path = `${apiPath}/${endpoint}`;
    const description = `${method} ${path}`;
    try {
      const response = await fetch(new URL(path, target), {
        method,
        headers,
        body: payload ? JSON.stringify(payload) : undefined,
        redirect: 'manual',
        signal: AbortSignal.timeout(15_000),
      });
      return { response, description };
    } catch (error) {
      throw new Error(`${description}: ${error.cause?.code ?? error.message}`, { cause: error });
    }
  }

  const getSession = (cookie) => request('session', { cookie });
  const post = (endpoint, payload, options) => request(endpoint, { method: 'POST', payload, ...options });

  await expectError(getSession(), 401, 'UNAUTHENTICATED');
  await expectError(post('register', { ...account, email: 'correo-invalido' }), 422, 'INVALID_INPUT');
  const withoutDataConsent = { ...account, consent: { ...consent, data: false } };
  const withoutTerms = { ...account, consent: { ...consent, terms: false } };
  const outdatedConsent = { ...account, consent: { ...consent, version: '2026-01' } };
  await expectError(post('register', withoutDataConsent), 422, 'CONSENT_REQUIRED');
  await expectError(post('register', withoutTerms), 422, 'CONSENT_REQUIRED');
  await expectError(post('register', outdatedConsent), 422, 'CONSENT_VERSION_MISMATCH');
  const thirdParty = { origin: 'https://sitio-ajeno.example' };
  await expectError(post('register', account, thirdParty), 403, 'ORIGIN_NOT_ALLOWED');
  console.info('Validación de formulario, consentimiento y origen verificada.');

  const registration = await checkStatus(post('register', account), 201);
  const userId = checkUser(registration, account);
  const registrationCookie = getSessionCookie(registration.response, target);
  assert.equal(checkUser(await checkStatus(getSession(registrationCookie), 200), account), userId);
  await expectError(post('register', account), 409, 'EMAIL_ALREADY_REGISTERED');
  console.info('Registro, restauración de sesión y rechazo de correo duplicado verificados.');

  const badPassword = { ...credentials, password: randomUUID() };
  const unknownAccount = { ...credentials, email: newAccount().email };
  const passwordError = await expectError(post('login', badPassword), 401, 'INVALID_CREDENTIALS');
  const accountError = await expectError(post('login', unknownAccount), 401, 'INVALID_CREDENTIALS');
  assert.deepEqual(accountError, passwordError, 'El fallo de login no debe indicar si el correo existe');

  const unnormalizedCredentials = { ...credentials, email: ` ${credentials.email.toUpperCase()} ` };
  const login = await checkStatus(post('login', unnormalizedCredentials, { cookie: registrationCookie }), 200);
  assert.equal(checkUser(login, account), userId);
  const loginCookie = getSessionCookie(login.response, target);
  assert(loginCookie.value !== registrationCookie.value, 'El inicio de sesión debe renovar la cookie');
  await expectError(getSession(registrationCookie), 401, 'UNAUTHENTICATED');
  assert.equal(checkUser(await checkStatus(getSession(loginCookie), 200), account), userId);
  console.info('Inicio de sesión, renovación de cookie y rechazo de credenciales inválidas verificados.');

  const crossOriginLogout = post('logout', undefined, { ...thirdParty, cookie: loginCookie });
  await expectError(crossOriginLogout, 403, 'ORIGIN_NOT_ALLOWED');
  await checkStatus(getSession(loginCookie), 200);
  const logout = await checkStatus(post('logout', undefined, { cookie: loginCookie }), 200);
  assert.deepEqual(logout.body?.data, {});
  checkExpiredCookie(logout.response, loginCookie);
  await expectError(getSession(loginCookie), 401, 'UNAUTHENTICATED');
  assert.deepEqual((await checkStatus(post('logout'), 200)).body?.data, {});
  console.info('Cierre de sesión, revocación e idempotencia verificados.');

  const concurrentAccount = newAccount();
  const registrations = await Promise.all([post('register', concurrentAccount), post('register', concurrentAccount)]);
  registrations.sort((first, second) => first.response.status - second.response.status);
  const created = await checkStatus(registrations[0], 201);
  await expectError(registrations[1], 409, 'EMAIL_ALREADY_REGISTERED');
  checkUser(created, concurrentAccount);
  const concurrentCookie = getSessionCookie(created.response, target);
  await checkStatus(post('logout', undefined, { cookie: concurrentCookie }), 200);
  console.info('Registro concurrente verificado.');
}

try {
  await run();
  console.info('Prueba de autenticación completada.');
} catch (error) {
  console.error(`Falló la prueba de autenticación. ${error.message}`);
  process.exitCode = 1;
}
