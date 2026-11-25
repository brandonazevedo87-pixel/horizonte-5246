import { and, eq, asc, desc } from 'drizzle-orm';
import { ORPCError } from '@orpc/server';
import { z } from 'zod';
import { authed } from '../middleware/auth';
import { db } from '../database';
import { clients, services, charges } from '../database/schema';

const id = z.uuid();
const title = z.string().trim().min(1).max(120);
const money = z.number().int().positive().max(999999999);
const date = z.iso.date();
const period = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/);
const notFound = () => new ORPCError('NOT_FOUND', { message: 'Registro não encontrado.' });
const ownedClient = (owner: string, key: string) => and(eq(clients.ownerId, owner), eq(clients.id, key));
const ownedService = (owner: string, key: string) => and(eq(services.ownerId, owner), eq(services.id, key));
const ownedCharge = (owner: string, key: string) => and(eq(charges.ownerId, owner), eq(charges.id, key));

export const ledger = {
  list: authed.handler(async ({context}) => {
    const owner = context.user.id;
    const [allClients, allServices, allCharges] = await Promise.all([
      db.select().from(clients).where(eq(clients.ownerId, owner)).orderBy(asc(clients.name)),
      db.select().from(services).where(eq(services.ownerId, owner)).orderBy(asc(services.name)),
      db.select().from(charges).where(eq(charges.ownerId, owner)).orderBy(desc(charges.due)),
    ]);
    return { clients: allClients, services: allServices, charges: allCharges };
  }),
  saveClient: authed.input(z.object({ id: id.optional(), name: title, email: z.union([z.literal(''), z.email().max(254)]), phone: z.string().trim().max(40) })).handler(async ({ input, context }) => {
    const values = {name: input.name, email: input.email || null, phone: input.phone || null};
    if (input.id) {
      const [row] = await db.update(clients).set(values).where(ownedClient(context.user.id, input.id)).returning();
      if (!row) throw notFound();
      return row;
    }
    const [row] = await db.insert(clients).values({ ...values, ownerId: context.user.id }).returning();
    return row;
  }),
  saveService: authed.input(z.object({ id: id.optional(), name: title, description: z.string().trim().max(500), price: money })).handler(async ({input, context}) => {
    const values = {name: input.name, description: input.description || null, price: input.price};
    if (input.id) {
      const [row] = await db.update(services).set(values).where(ownedService(context.user.id, input.id)).returning();
      if (!row) throw notFound();
      return row;
    }
    const [row] = await db.insert(services).values({ ...values, ownerId: context.user.id }).returning();
    return row;
  }),
  saveCharge: authed.input(z.object({ id: id.optional(), clientId: id, serviceId: id, due: date, period, amount: money })).handler(async ({ input, context }) => {
    const owner = context.user.id;
    const values = { clientId: input.clientId, serviceId: input.serviceId, due: input.due, period: input.period, amount: input.amount };
    const [[client], [service]] = await Promise.all([
      db.select({id: clients.id}).from(clients).where(ownedClient(owner, input.clientId)),
      db.select({id: services.id}).from(services).where(ownedService(owner, input.serviceId)),
    ]);
    if (!client || !service) throw notFound();
    try {
      if (input.id) {
        const [row] = await db.update(charges).set(values).where(ownedCharge(owner, input.id)).returning();
        if (!row) throw notFound();
        return row;
      }
      const [row] = await db.insert(charges).values({ ...values, ownerId: owner }).returning();
      return row;
    } catch (error) {
      if (String(error).includes('UNIQUE constraint')) throw new ORPCError('CONFLICT', { message: 'Já existe uma mensalidade deste serviço para esse cliente nesse mês.' });
      throw error;
    }
  }),
  recordPayment: authed.input(z.object({ id, paidAt: date.nullable() })).handler(async ({input, context}) => {
    const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year:'numeric', month:'2-digit', day:'2-digit' }).format();
    if (input.paidAt && input.paidAt > today) throw new ORPCError('BAD_REQUEST', { message: 'Informe uma data de pagamento que não esteja no futuro.' });
    const [row] = await db.update(charges).set({ paidAt: input.paidAt }).where(ownedCharge(context.user.id, input.id)).returning();
    if (!row) throw notFound();
    return row;
  }),
};
