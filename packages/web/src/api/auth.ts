import { betterAuth } from 'better-auth';
import { timingSafeEqual } from 'node:crypto';
import { APIError, createAuthMiddleware } from 'better-auth/api';
import { user } from './database/auth-schema';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { bearer } from 'better-auth/plugins';
import { db } from './database';

const hosts = ['localhost:4200', '127.0.0.1:4200'];
const trustedOrigins = [process.env.WEBSITE_URL, process.env.PANEL_CUSTOM_DOMAIN, process.env.PANEL_PREVIEW_PROXY_ORIGIN].filter((url): url is string => Boolean(url)).map(url => new URL(url).origin);
if (process.env.PANEL_CUSTOM_DOMAIN) hosts.push(new URL(process.env.PANEL_CUSTOM_DOMAIN).host);
if (process.env.WEBSITE_URL) hosts.push(new URL(process.env.WEBSITE_URL).host);

export const auth = betterAuth({
  basePath: '/api/auth',
  baseURL: { allowedHosts: hosts, fallback: process.env.PANEL_CUSTOM_DOMAIN || process.env.WEBSITE_URL },
  trustedOrigins,
  database: drizzleAdapter(db, { provider: 'sqlite' }),
  emailAndPassword: { enabled: true, minPasswordLength: 10, maxPasswordLength: 128 },
  secret: process.env.BETTER_AUTH_SECRET,
  advanced: { database: { generateId: ({ model }) => model === 'user' ? 'painel-owner' : crypto.randomUUID() } },
  rateLimit: { enabled: true, window: 60, max: 100 },
  hooks: { before: createAuthMiddleware(async (ctx) => {
    if (ctx.path !== '/sign-up/email') return;
    const expected = process.env.OWNER_SETUP_TOKEN;
    const supplied = ctx.headers?.get('x-owner-invite') ?? '';
    if (!expected || supplied.length !== expected.length || !/^[a-f0-9]{64}$/.test(supplied) || !timingSafeEqual(Buffer.from(expected), Buffer.from(supplied))) {
      throw new APIError('FORBIDDEN', { message: 'Use o convite privado para criar o acesso.' });
    }
    const [existing] = await db.select({id: user.id}).from(user).limit(1);
    if (existing) throw new APIError('FORBIDDEN', { message: 'O acesso já foi cadastrado. Entre com seu e-mail e senha.' });
  }) },
  plugins: [bearer({ requireSignature: true })],
});
