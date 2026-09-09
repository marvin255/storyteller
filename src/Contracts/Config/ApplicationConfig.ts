export type ApplicationConfig = Readonly<{
    database:
        | {
              host: string;
              port: number;
              user: string;
              password: string;
              database: string;
          }
        | undefined;
}>;
