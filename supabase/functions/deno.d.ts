declare namespace Deno {
  interface Env {
    get(key: string): string | undefined;
  }

  const env: Env;

  function serve(
    handler: (request: Request) => Response | Promise<Response>
  ): void;
}

declare module "https://deno.land/std@0.168.0/http/server.ts" {
  export function serve(
    handler: (request: Request) => Response | Promise<Response>
  ): void;
}
