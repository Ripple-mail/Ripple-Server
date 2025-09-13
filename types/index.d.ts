declare namespace NodeJS {
    interface ProcessEnv {
        DATABASE_URL: string;
        PORT?: string;
        NODE_ENV?: 'production' | 'development';
        JWT_SECRET?: string;
        USE_EMLS?: 'true' | 'false';
        TRUST_PROXY?: 'true' | 'false';
    }
}