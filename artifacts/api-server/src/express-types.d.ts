export {};
// Express 5 changed ParamsDictionary to string | string[] for wildcard routes.
// Our routes only use simple :param patterns (always single strings).
declare module "express-serve-static-core" {
  interface ParamsDictionary {
    [key: string]: string;
  }
}
