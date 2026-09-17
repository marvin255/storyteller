export type ApplicationConfig = Readonly<{
    defaultLocale: string;
    database?: Readonly<{
        host: string;
        port: number;
        user: string;
        password: string;
        database: string;
    }>;
    promptDirectory: string;
    llm?: Readonly<{
        provider: string;
        model: string;
        apiKey?: string;
    }>;
}>;
