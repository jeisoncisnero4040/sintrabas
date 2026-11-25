import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';

const SCHEME = 'scrypt-v1';
const KEY_LENGTH = 64;
const OPTIONS = { N: 65536, r: 8, p: 2, maxmem: 96 * 1024 * 1024 };
const DUMMY_SALT = Buffer.from('cd35394c35bd21a99f2606bd8969be243', 'hex');
const DUMMY_KEY = Buffer.alloc(KEY_LENGTH);

function deriveKey(password: string, salt: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password, salt, KEY_LENGTH, OPTIONS, (error, key) => {
      if (error) reject(error);
      else resolve(key);
    });
  });
}

export const passwords = {
  async hash(password: string) {
    const salt = randomBytes(16);
    const key = await deriveKey(password, salt);
    return [SCHEME, salt.toString('hex'), key.toString('hex')].join('$');
  },

  async verify(password: string, hash: string | undefined) {
    const [scheme, salt = '', expected = '', extra] = hash?.split('$') ?? [];
    const validHash = scheme === SCHEME && /^[a-f0-9]{32}$/u.test(salt)
      && /^[a-f0-9]{128}$/u.test(expected) && extra === undefined;
    const key = await deriveKey(password, validHash ? Buffer.from(salt, 'hex') : DUMMY_SALT);
    const matches = timingSafeEqual(key, validHash ? Buffer.from(expected, 'hex') : DUMMY_KEY);
    return validHash && matches;
  },
};
