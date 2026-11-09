import { BuildNotificationsUseCase } from '../../src/application/use-cases/BuildNotificationsUseCase';
import { loadInterests } from '../../src/application/use-cases/LoadInterestsUseCase';
import { AppStateRepositoryFake } from '../../src/application/fakes/AppStateRepositoryFake';
import { AdoptionInterestRepositoryFake } from '../../src/application/fakes/AdoptionInterestRepositoryFake';
import { SyncQueueRepositoryFake } from '../../src/application/fakes/SyncQueueRepositoryFake';
import { AnimalRepositoryFake } from '../../src/application/fakes/AnimalRepositoryFake';
import { InterestRemoteGateway } from '../../src/domain/ports/InterestRemoteGateway';
import { AdoptionInterest } from '../../src/domain/entities/AdoptionInterest';
import { SyncAction } from '../../src/domain/entities/SyncAction';
import { InterestStatus } from '../../src/domain/value-objects/InterestStatus';
const row = {id:'i',userId:'u',animalId:'a',status:'EM_ANALISE',createdAt:'2026-11-01T10:00:00Z',updatedAt:'2026-11-02T10:00:00+00:00'};
const remote = () => ({listForUser:jest.fn().mockResolvedValue([row]),listForAnimal:jest.fn().mockResolvedValue([row]),createRemote:jest.fn(),updateStatusRemote:jest.fn()}) as InterestRemoteGateway;
it('imports remote-only interests and retains their stage offline',async()=>{
 const local=new AdoptionInterestRepositoryFake(); const gateway=remote();
 expect((await loadInterests(local,gateway,'user','u'))[0].status).toBe('EM_ANALISE');
 (gateway.listForUser as jest.Mock).mockRejectedValue(new Error('offline'));
 expect((await loadInterests(local,gateway,'user','u'))[0].status).toBe('EM_ANALISE');
});
it('preserves a queued decision over older remote data',async()=>{
 const local=new AdoptionInterestRepositoryFake(), queue=new SyncQueueRepositoryFake();
 await local.registerInterest(new AdoptionInterest('i','u','a',row.createdAt,InterestStatus.visitaCombinada()));
 await queue.enqueue(new SyncAction({id:'q',entityId:'i',entityType:'interest',operation:'UPDATE',payload:{ownerId:'owner'}}));
 expect((await loadInterests(local,remote(),'user','u',queue))[0].status).toBe('VISITA_COMBINADA');
});
it('read cutoff survives new use-case instances, respects timezone formats and isolates accounts',async()=>{
 const state=new AppStateRepositoryFake(), local=new AdoptionInterestRepositoryFake();
 const extras={localInterests:local,remoteInterests:remote(),animalRepository:new AnimalRepositoryFake()};
 const feed=new BuildNotificationsUseCase(state,extras);
 expect((await feed.execute('u')).unseenCount).toBe(1);
 await feed.markSeen('u','2026-11-02T10:00:00.000Z');
 expect((await new BuildNotificationsUseCase(state,extras).execute('u')).unseenCount).toBe(0);
 expect(await state.get('notifications_last_seen:other')).toBeNull();
 expect((await feed.execute('')).items).toHaveLength(0);
});
it('only exposes failed actions owned by the active user',async()=>{
 const queue=new SyncQueueRepositoryFake();
 for(const user of ['u','other']) { const a=new SyncAction({id:user,entityId:'a',entityType:'animal',operation:'UPDATE',payload:{ownerId:user}}); a.markFailed('offline'); await queue.enqueue(a); }
 const feed=await new BuildNotificationsUseCase(new AppStateRepositoryFake(),{syncQueueRepository:queue}).execute('u');
 expect(feed.items).toHaveLength(1); expect(feed.items[0].id).toContain('sync:u:');
});
