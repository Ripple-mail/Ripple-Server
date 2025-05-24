import { z } from 'zod';

const storageLayoutSchema = z.union([
    z.tuple([z.literal('mailDir'), z.literal('userName'), z.literal('tempCurNew')]),
    z.tuple([z.literal('mailDir'), z.literal('tempCurNew'), z.literal('userName')]),
    z.tuple([z.literal('userName'), z.literal('mailDir'), z.literal('tempCurNew')]),
    z.tuple([z.literal('userName'), z.literal('tempCurNew'), z.literal('mailDir')]),
    z.tuple([z.literal('tempCurNew'), z.literal('mailDir'), z.literal('userName')]),
    z.tuple([z.literal('tempCurNew'), z.literal('userName'), z.literal('mailDir')])
]);

const storageSchema = z.object({
    basePath: z.string().nonempty().default('./storage'),

    layout: storageLayoutSchema.optional()
}).optional();

const serverSchema = z.object({
    port: z.number().int().min(1).max(65535).default(25).describe('Port to host server on').optional(),
    storage: storageSchema
}).optional();

const clientSchema = z.object({
    host: z.string().url({ message: 'Invalid URL' }).optional().describe('URL string'),
    port: z.number().int().min(1).max(65535).default(25).describe('Port to connect to').optional()
}).optional();

const configSchema = z.object({
    server: serverSchema,
    client: clientSchema
});
export type Config = z.infer<typeof configSchema>;