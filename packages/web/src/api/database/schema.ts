import { index, integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';
import { user } from './auth-schema';
export * from './auth-schema';

const owner = () => text('owner_id').notNull().references(() => user.id, { onDelete: 'cascade' });
const id = () => text('id').primaryKey().$defaultFn(() => crypto.randomUUID());
export const clients = sqliteTable('clients', {
  id: id(), ownerId: owner(), name: text().notNull(), email: text(), phone: text(),
}, (t) => [index('clients_owner').on(t.ownerId)]);
export const services = sqliteTable('services', {
  id: id(), ownerId: owner(), name: text().notNull(), description: text(), price: integer().notNull(),
}, (t) => [index('services_owner').on(t.ownerId)]);
export const charges = sqliteTable('charges', {
  id: id(), ownerId: owner(), clientId: text('client_id').notNull().references(() => clients.id),
  serviceId: text('service_id').notNull().references(() => services.id),
  amount: integer().notNull(), period: text().notNull(), due: text().notNull(), paidAt: text('paid_at'),
}, (t) => [index('charges_owner').on(t.ownerId), uniqueIndex('charges_month_unique').on(t.ownerId,t.clientId,t.serviceId,t.period)]);
