import { createHash } from "node:crypto";
import { Redis } from "@upstash/redis";
import { z } from "zod";

export const pushSubscriptionSchema = z.object({
  endpoint: z.url().max(2048), expirationTime: z.number().nullable().optional(),
  keys: z.object({ p256dh: z.string().min(20).max(512), auth: z.string().min(8).max(256) }),
  timezone: z.string().min(1).max(80).default("America/Sao_Paulo"),
  preferences: z.object({ enabled: z.boolean(), time: z.string().regex(/^\d{2}:\d{2}$/), days: z.array(z.number().int().min(0).max(6)).max(7) }),
});
export type StoredPush = z.infer<typeof pushSubscriptionSchema> & { id: string; lastSentKey?: string };

export const subscriptionId = (endpoint: string) => createHash("sha256").update(endpoint).digest("hex");
export function getRedis() { if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) return undefined; return Redis.fromEnv(); }
export const pushKey = (id: string) => `meu-treino:push:${id}`;
export const PUSH_SET = "meu-treino:push:index";
