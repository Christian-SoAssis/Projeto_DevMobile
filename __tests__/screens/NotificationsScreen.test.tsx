import React from 'react';
import { render, waitFor, fireEvent } from '@testing-library/react-native';
import { NotificationsScreen } from '../../src/adapters/screens/NotificationsScreen';
import { BuildNotificationsUseCase } from '../../src/application/use-cases/BuildNotificationsUseCase';
import { AppStateRepositoryFake } from '../../src/application/fakes/AppStateRepositoryFake';
import { AdoptionInterestRepositoryFake } from '../../src/application/fakes/AdoptionInterestRepositoryFake';
import { AnimalRepositoryFake } from '../../src/application/fakes/AnimalRepositoryFake';
import { AdoptionInterest } from '../../src/domain/entities/AdoptionInterest';
import { InterestStatus } from '../../src/domain/value-objects/InterestStatus';
it('reloads on focus pulse, marks viewed and opens the target',async()=>{
 const local=new AdoptionInterestRepositoryFake(),state=new AppStateRepositoryFake();
 const useCase=new BuildNotificationsUseCase(state,{localInterests:local,animalRepository:new AnimalRepositoryFake()});
 const open=jest.fn();
 const screen=await render(<NotificationsScreen userId="u" useCase={useCase} onOpenItem={open}/>);
 await screen.findByTestId('notifications-empty');
 await local.registerInterest(new AdoptionInterest('i','u','a',undefined,InterestStatus.emAnalise()));
 await screen.rerender(<NotificationsScreen userId="u" useCase={useCase} refreshToken={1} onOpenItem={open}/>);
 await screen.findByText('Sua manifestação mudou de etapa');
 await fireEvent.press(screen.getByText('Sua manifestação mudou de etapa'));
 expect(open).toHaveBeenCalledWith(expect.objectContaining({animalId:'a'}));
 await waitFor(async()=>expect((await useCase.execute('u')).unseenCount).toBe(0));
});
it('shows login guidance to visitors',async()=>{
 const s=await render(<NotificationsScreen userId={null} useCase={new BuildNotificationsUseCase(new AppStateRepositoryFake())}/>);
 expect(s.getByTestId('notifications-visitor')).toBeTruthy();
});
