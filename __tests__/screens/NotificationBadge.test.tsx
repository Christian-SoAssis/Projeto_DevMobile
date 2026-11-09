import { act, renderHook, waitFor } from '@testing-library/react-native';
import { useUnseenNotifications } from '../../src/adapters/hooks/useUnseenNotifications';
import { notifyNotificationsChanged } from '../../src/adapters/sync/notificationEvents';
import { BuildNotificationsUseCase } from '../../src/application/use-cases/BuildNotificationsUseCase';
import { AppStateRepositoryFake } from '../../src/application/fakes/AppStateRepositoryFake';
it('recounts on read events and resets after logout',async()=>{
 const useCase=new BuildNotificationsUseCase(new AppStateRepositoryFake());
 const execute=jest.spyOn(useCase,'execute').mockResolvedValue({items:[],unseenCount:2});
 const hook=await renderHook(({id}:{id:string|null})=>useUnseenNotifications(useCase,id),{initialProps:{id:'u' as string|null}});
 await waitFor(()=>expect(hook.result.current).toBe(2));
 execute.mockResolvedValue({items:[],unseenCount:0});
 await act(async()=>notifyNotificationsChanged());
 await waitFor(()=>expect(hook.result.current).toBe(0));
 await hook.rerender({id:null}); expect(hook.result.current).toBe(0);
 hook.unmount();
});
it('handles unavailable repositories without inventing a badge',async()=>{
 const c=new BuildNotificationsUseCase(new AppStateRepositoryFake()); jest.spyOn(c,'execute').mockRejectedValue(new Error('db'));
 const h=await renderHook(()=>useUnseenNotifications(c,'u'));
 await waitFor(()=>expect(c.execute).toHaveBeenCalled()); expect(h.result.current).toBe(0);
});
