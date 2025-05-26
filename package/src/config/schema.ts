import z from 'zod';

const storageLayoutSchema: z.ZodUnion<[
    z.ZodTuple<[z.ZodLiteral<'mailDir'>, z.ZodLiteral<'userName'>, z.ZodLiteral<'tempCurNew'>]>,
    z.ZodTuple<[z.ZodLiteral<'mailDir'>, z.ZodLiteral<'tempCurNew'>, z.ZodLiteral<'userName'>]>,
    z.ZodTuple<[z.ZodLiteral<'userName'>, z.ZodLiteral<'mailDir'>, z.ZodLiteral<'tempCurNew'>]>,
    z.ZodTuple<[z.ZodLiteral<'userName'>, z.ZodLiteral<'tempCurNew'>, z.ZodLiteral<'mailDir'>]>,
    z.ZodTuple<[z.ZodLiteral<'tempCurNew'>, z.ZodLiteral<'mailDir'>, z.ZodLiteral<'userName'>]>,
    z.ZodTuple<[z.ZodLiteral<'tempCurNew'>, z.ZodLiteral<'userName'>, z.ZodLiteral<'mailDir'>]>,
]> = z.union([
    z.tuple([z.literal('mailDir'), z.literal('userName'), z.literal('tempCurNew')]),
    z.tuple([z.literal('mailDir'), z.literal('tempCurNew'), z.literal('userName')]),
    z.tuple([z.literal('userName'), z.literal('mailDir'), z.literal('tempCurNew')]),
    z.tuple([z.literal('userName'), z.literal('tempCurNew'), z.literal('mailDir')]),
    z.tuple([z.literal('tempCurNew'), z.literal('mailDir'), z.literal('userName')]),
    z.tuple([z.literal('tempCurNew'), z.literal('userName'), z.literal('mailDir')])
]);

type storageLayout =
| ['mailDir', 'userName', 'tempCurNew']
| ['mailDir', 'tempCurNew', 'userName']
| ['userName', 'mailDir', 'tempCurNew']
| ['userName', 'tempCurNew', 'mailDir']
| ['tempCurNew', 'mailDir', 'userName']
| ['tempCurNew', 'userName', 'mailDir'];

type authMethods = 'PLAIN' | 'LOGIN' |'CRAM-MD5' | 'XOAUTH2';

type arrayAtLeastOne<T> =
| undefined
| [T, ...T[]]

declare const configSchema: z.ZodEffects<z.ZodObject<{
    server: z.ZodOptional<z.ZodObject<{
        port: z.ZodOptional<z.ZodNumber>;
        storage: z.ZodOptional<z.ZodObject<{
            basePath: z.ZodOptional<z.ZodString>;
            layout: z.ZodOptional<typeof storageLayoutSchema>
        }, "strip", z.ZodTypeAny, {
            basePath?: string | undefined;
            layout?: storageLayout | undefined;
        }, {
            basePath?: string | undefined;
            layout?: storageLayout | undefined;
        }>>;
        secure: z.ZodOptional<z.ZodBoolean>;
        tlsMode: z.ZodOptional<z.ZodEnum<['none', 'starttls', 'ssl']>>;
        maxClients: z.ZodOptional<z.ZodNumber>;
        auth: z.ZodOptional<z.ZodEffects<z.ZodUnion<[z.ZodBoolean, z.ZodObject<{
            required: z.ZodBoolean;
            allowedMethods: z.ZodOptional<z.ZodArray<z.ZodEnum<['PLAIN', 'LOGIN', 'CRAM-MD5', 'XOAUTH2']>, "atleastone">>;
        }, "strip", z.ZodTypeAny, {
            required: boolean;
            allowedMethods?: [authMethods, ...authMethods[]] | undefined;
        }, {
            required: boolean;
            allowedMethods?: [authMethods, ...authMethods[]] | undefined;
        }>]>, {
            required: boolean;
            allowedMethods: [authMethods, ...authMethods[]] | undefined;
        }, boolean | {
            required: boolean;
            allowedMethods?: [authMethods, ...authMethods[]] | undefined;
        }>>;
        rateLimit: z.ZodOptional<z.ZodObject<{
            windowMs: z.ZodNumber;
            max: z.ZodNumber;
        }, "strip", z.ZodTypeAny, {
            windowMs: number;
            max: number;
        }, {
            windowMs: number;
            max: number;
        }>>;
    }>>;
    client: z.ZodOptional<z.ZodObject<{
        host: z.ZodOptional<z.ZodEffects<z.ZodUnion<[z.ZodString, z.ZodObject<{
            url: z.ZodOptional<z.ZodString>;
            port: z.ZodOptional<z.ZodNumber>;
        }, "strip", z.ZodTypeAny, {
            url?: string | undefined;
            port?: number | undefined;
        }, {
            url?: string | undefined;
            port?: number | undefined;
        }>]>, {
            url: string | undefined;
            port: number | undefined;
        }, string | {
            url?: string | undefined;
            port?: number | undefined;
        }>>;
        secure: z.ZodOptional<z.ZodBoolean>;
        tlsMode: z.ZodOptional<z.ZodEnum<['none', 'starttls', 'ssl']>>;
        connectionRetry: z.ZodOptional<z.ZodObject<{
            attempts: z.ZodNumber;
            delayFormat: z.ZodEnum<['ms', 's', 'm']>;
            delayMs: z.ZodNumber;
        }, "strip", z.ZodTypeAny, {
            attempts: number;
            delayFormat: 'ms' | 's' | 'm';
            delay: number;
        }, {
            attempts: number;
            delayFormat: 'ms' | 's' | 'm';
            delay: number;
        }>>;
        timeoutMs: z.ZodOptional<z.ZodNumber>;
        auth: z.ZodOptional<z.ZodObject<{
            user: z.ZodString;
            pass: z.ZodString;
            method: z.ZodOptional<z.ZodEnum<['PLAIN', 'LOGIN', 'CRAM-MD5', 'XOAUTH2']>>;
        }, "strip", z.ZodTypeAny, {
            user: string;
            pass: string;
            method?: authMethods | undefined;
        }, {
            user: string;
            pass: string;
            method?: authMethods | undefined;
        }>>;
        metadata: z.ZodOptional<z.ZodObject<{
            helo: z.ZodOptional<z.ZodEffects<z.ZodUnion<[z.ZodString, z.ZodObject<{
                method: z.ZodEnum<['HELO', 'EHLO']>;
                message: z.ZodString;
            }, "strip", z.ZodTypeAny, {
                method: 'HELO' | 'EHLO';
                message: string;
            }, {
                method: 'HELO' | 'EHLO';
                message: string;
            }>]>, {
                method: 'HELO' | 'EHLO';
                message: string;
            }, string | {
                method: 'HELO' | 'EHLO',
                message: string;
            }>>;
            from: z.ZodOptional<z.ZodString>;
            rcpt: z.ZodOptional<z.ZodString>;
        }>>;
    }>>;
}, "strip", z.ZodTypeAny, {
    server?: {
        port: number | undefined;
        storage?: {
            basePath: string | undefined;
            layout: storageLayout | undefined;
        } | undefined;
        secure: boolean | undefined;
        tlsMode: 'none' | 'starttls' | 'ssl' | undefined;
        maxClients: number | undefined;
        auth?: {
            required: boolean;
            allowedMethods: authMethods[] | undefined;
        } | boolean | undefined;
        rateLimit?: {
            windowMs: number;
            max: number;
        } | undefined;
    } | undefined;
    client?: {
        host?: {
            url: string | undefined;
            port: number | undefined;
        } | string | undefined;
        secure: boolean | undefined;
        tlsMode: 'none' | 'starttls' | 'ssl' | undefined;
        connectionRetry?: {
            attempts: number;
            delayFormat: 'ms' | 's' | 'm';
            delay: number;
        } | undefined;
        timeoutMs: number | undefined;
        auth?: {
            user: string;
            pass: string;
            method: authMethods | undefined;
        } | undefined;
        metadata?: {
            helo?: {
                method: 'HELO' | 'EHLO';
                message: string;
            } | string | undefined;
            from: string | undefined;
            rcpt: string | undefined;
        } | undefined;
    } | undefined;
}, {
    server?: {
        port?: number | undefined;
        storage?: {
            basePath?: string | undefined;
            layout?: storageLayout | undefined;
        } | undefined;
        secure?: boolean | undefined;
        tlsMode?: 'none' | 'starttls' | 'ssl' | undefined;
        maxClients?: number | undefined;
        auth?: {
            required: boolean;
            allowedMethods?: authMethods[] | undefined;
        } | boolean | undefined;
        rateLimit?: {
            windowMs: number;
            max: number;
        } | undefined;
    } | undefined;
    client?: {
        host?: string | {
            url?: string | undefined;
            port?: number | undefined;
        } | string | undefined;
        secure?: boolean | undefined;
        tlsMode?: 'none' | 'starttls' | 'ssl' | undefined;
        connectionRetry?: {
            attempts: number;
            delayFormat: 'ms' | 's' | 'm';
            delay: number;
        } | undefined;
        timeoutMs?: number | undefined;
        auth?: {
            user: string;
            pass: string;
            method?: authMethods | undefined;
        } | undefined;
        metadata?: {
            helo?: {
                method: 'HELO' | 'EHLO';
                message: string;
            } | string | undefined;
            from?: string | undefined;
            rcpt?: string | undefined;
        } | undefined;
    } | undefined;
}>, {
    server?: {
        port: number | undefined;
        storage?: {
            basePath: string | undefined;
            layout: storageLayout | undefined;
        } | undefined;
        secure: boolean | undefined;
        tlsMode: 'none' | 'starttls' | 'ssl' | undefined;
        maxClients: number | undefined;
        auth?: {
            required: boolean;
            allowedMethods: authMethods[] | undefined;
        } | boolean | undefined;
        rateLimit?: {
            windowMs: number;
            max: number;
        } | undefined;
    } | undefined;
    client?: {
        host?: {
            url: string | undefined;
            port: number | undefined;
        } | string | undefined;
        secure: boolean | undefined;
        tlsMode: 'none' | 'starttls' | 'ssl' | undefined;
        connectionRetry?: {
            attempts: number;
            delayFormat: 'ms' | 's' | 'm';
            delay: number;
        } | undefined;
        timeoutMs: number | undefined;
        auth?: {
            user: string;
            pass: string;
            method: authMethods | undefined;
        } | undefined;
        metadata?: {
            helo?: {
                method: 'HELO' | 'EHLO';
                message: string;
            } | string | undefined;
            from: string | undefined;
            rcpt: string | undefined;
        } | undefined;
    } | undefined;
}, {
    server?: {
        port?: number | undefined;
        storage?: {
            basePath?: string | undefined;
            layout?: storageLayout | undefined;
        } | undefined;
        secure?: boolean | undefined;
        tlsMode?: 'none' | 'starttls' | 'ssl' | undefined;
        maxClients?: number | undefined;
        auth?: {
            required: boolean;
            allowedMethods?: authMethods[] | undefined;
        } | boolean | undefined;
        rateLimit?: {
            windowMs: number;
            max: number;
        } | undefined;
    } | undefined;
    client?: {
        host?: string | {
            url?: string | undefined;
            port?: number | undefined;
        } | string | undefined;
        secure?: boolean | undefined;
        tlsMode?: 'none' | 'starttls' | 'ssl' | undefined;
        connectionRetry?: {
            attempts: number;
            delayFormat: 'ms' | 's' | 'm';
            delay: number;
        } | undefined;
        timeoutMs?: number | undefined;
        auth?: {
            user: string;
            pass: string;
            method?: authMethods | undefined;
        } | undefined;
        metadata?: {
            helo?: {
                method: 'HELO' | 'EHLO';
                message: string;
            } | string | undefined;
            from?: string | undefined;
            rcpt?: string | undefined;
        } | undefined;
    } | undefined;
}>;

export type SMTPConfig = z.input<typeof configSchema>;