(apagar esse arquivo depois)

Erros encontrados

npm run typecheck

> projeto-dev-mobile@1.0.0 typecheck
> tsc --noEmit

__tests__/application/AdditionalCoverage.test.ts:70:36 - error TS2345: Argument of type 'Animal' is not assignable to parameter of type 'string'.

70     await expect(repo.deleteRemote(a1)).rejects.toThrow();
                                      ~~

