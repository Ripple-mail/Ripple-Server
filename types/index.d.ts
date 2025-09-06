declare namespace NodeJS {
    interface ProcessEnv {
        DATABASE_URL: string;
        PORT: string;
        NODE_ENV: 'production' | 'development';
        USE_EMLS: 'true' | 'false';
    }
}