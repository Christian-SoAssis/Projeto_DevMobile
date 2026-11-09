import { UpdateInterestStatusUseCase } from '../../src/application/use-cases/UpdateInterestStatusUseCase';
import { AdoptionInterestRepositoryFake } from '../../src/application/fakes/AdoptionInterestRepositoryFake';
import { SyncQueueRepositoryFake } from '../../src/application/fakes/SyncQueueRepositoryFake';
import { AdoptionInterest } from '../../src/domain/entities/AdoptionInterest';
import { InterestStatus } from '../../src/domain/value-objects/InterestStatus';
import { AnimalRepository } from '../../src/domain/ports/AnimalRepository';
const animals = { findById: async () => ({ ownerId: 'owner' }) } as unknown as AnimalRepository;
function setup(status = InterestStatus.enviada()) {
 const repo = new AdoptionInterestRepositoryFake(); const queue = new SyncQueueRepositoryFake();
 const interest = new AdoptionInterest('i', 'adopter', 'a', undefined, status);
 return {repo, queue, interest, useCase: new UpdateInterestStatusUseCase(repo, queue, undefined, animals)};
}
it('persists a remote-only interest and attributes its queued update to the owner', async () => {
 const {repo,queue,interest,useCase} = setup();
 await useCase.execute(interest, InterestStatus.emAnalise(), 'owner');
 expect((await repo.listByAnimal('a'))[0].status.value).toBe('EM_ANALISE');
 expect((await queue.listPending())[0].ownerId).toBe('owner');
});
it('rejects a non-owner without writing data', async () => {
 const {repo,queue,interest,useCase} = setup();
 await expect(useCase.execute(interest, InterestStatus.emAnalise(), 'adopter')).rejects.toThrow('responsável');
 expect(await queue.listPending()).toHaveLength(0); expect(await repo.listByAnimal('a')).toHaveLength(0);
});
it('rejects skipping steps and reopening a refused interest', async () => {
 const a=setup(); await expect(a.useCase.execute(a.interest,InterestStatus.concluida(),'owner')).rejects.toThrow('inválida');
 const b=setup(InterestStatus.recusada()); await expect(b.useCase.execute(b.interest,InterestStatus.emAnalise(),'owner')).rejects.toThrow('inválida');
});
it.each([InterestStatus.visitaCombinada(), InterestStatus.concluida()])('cannot refuse a confirmed visit or conclusion',async status => {
 const a=setup(status); await expect(a.useCase.execute(a.interest,InterestStatus.recusada(),'owner')).rejects.toThrow('Visita');
});
it('allows refusal during analysis',async()=>{ const a=setup(InterestStatus.emAnalise()); await a.useCase.execute(a.interest,InterestStatus.recusada(),'owner'); expect((await a.repo.listByAnimal('a'))[0].status.isRecusada()).toBe(true); });
