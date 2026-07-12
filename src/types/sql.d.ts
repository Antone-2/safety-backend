declare module 'sql.js' {
  interface SqlJsStatic {
    Database: {
      new (data?: ArrayLike<number> | null): Database;
    };
  }

  interface Database {
    export(): ArrayBuffer;
    run(sql: string, params?: any[]): Database;
    prepare(sql: string, params?: any[]): Statement;
    exec(sql: string, params?: any[]): { columns: string[]; values: any[][] };
    close(): void;
  }

  interface Statement {
    run(params?: any[]): Statement;
    get(params?: any[]): Record<string, any>;
    all(...params: any[]): Array<Record<string, any>>;
    step(): boolean;
    getAsObject(params?: any[]): Record<string, any>;
    bind(params?: any[]): Statement;
    reset(): Statement;
    free(): void;
  }

  interface SqlJsConfig {
    locateFile?: (filename: string) => string;
  }

  function initSqlJs(config?: SqlJsConfig): Promise<SqlJsStatic>;
  export default initSqlJs;
  export { Database, Statement };
}
