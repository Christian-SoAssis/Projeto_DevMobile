import { Animal } from '../../domain/entities/Animal';
import { AnimalCharacteristics } from '../../domain/value-objects/AnimalCharacteristics';
import { ApproximateLocation } from '../../domain/value-objects/ApproximateLocation';
import { AdoptionStatus } from '../../domain/value-objects/AdoptionStatus';
import { AnimalPhoto } from '../../domain/entities/AnimalPhoto';

/**
 * Seed compartilhado da demo (Fase 1): usado tanto pelos fakes em memória
 * de `sharedFakes` quanto pelo seed inicial do cache SQLite no container
 * real (`loadAppContainer`, Fase 2).
 */
export function buildSeedAnimals(): Animal[] {
  return [
    new Animal({
      id: 'anim_1',
      ownerId: 'usr_1',
      name: 'Luna',
      characteristics: new AnimalCharacteristics({
        species: 'Cão',
        size: 'Médio',
        approximateAge: '2 anos',
        sex: 'Fêmea',
        behavior: 'Dócil e brincalhona',
        specialCare: 'Castrada e com vacinas em dia',
      }),
      location: new ApproximateLocation({
        latitude: -21.554,
        longitude: -45.435,
        neighborhood: 'Centro',
        city: 'Varginha',
        region: 'MG',
      }),
      photos: [
        new AnimalPhoto({
          id: 'photo_luna',
          animalId: 'anim_1',
          remoteUrl: 'https://images.unsplash.com/photo-1543466835-00a7907e9de1',
        }),
      ],
    }),
    new Animal({
      id: 'anim_2',
      ownerId: 'usr_1',
      name: 'Mingau',
      characteristics: new AnimalCharacteristics({
        species: 'Gato',
        size: 'Pequeno',
        approximateAge: '1 ano',
        sex: 'Macho',
        behavior: 'Calmo e carinhoso',
      }),
      location: new ApproximateLocation({
        latitude: -21.56,
        longitude: -45.44,
        neighborhood: 'Vila Paiva',
        city: 'Varginha',
        region: 'MG',
      }),
      photos: [
        new AnimalPhoto({
          id: 'photo_mingau',
          animalId: 'anim_2',
          remoteUrl: 'https://images.unsplash.com/photo-1518791841217-8f162f1e1131',
        }),
      ],
    }),
    new Animal({
      id: 'anim_3',
      ownerId: 'usr_ong_esperanca',
      name: 'Thor',
      characteristics: new AnimalCharacteristics({
        species: 'Cão',
        size: 'Grande',
        approximateAge: '3 anos',
        sex: 'Macho',
        behavior: 'Sociável, protetor e muito companheiro',
        specialCare: 'Precisa de espaço amplo para correr e gastar energia',
      }),
      location: new ApproximateLocation({
        latitude: -21.55,
        longitude: -45.43,
        neighborhood: 'Centro',
        city: 'Varginha',
        region: 'MG',
      }),
      photos: [
        new AnimalPhoto({
          id: 'photo_thor',
          animalId: 'anim_3',
          remoteUrl: 'https://images.unsplash.com/photo-1552053831-71594a27632d',
        }),
      ],
    }),
    new Animal({
      id: 'anim_4',
      ownerId: 'usr_ong_esperanca',
      name: 'Pipoca',
      characteristics: new AnimalCharacteristics({
        species: 'Cão',
        size: 'Pequeno',
        approximateAge: '6 meses',
        sex: 'Fêmea',
        behavior: 'Filhote cheia de energia, carinhosa e adora brincar com crianças',
        specialCare: 'Primeira dose de vacina aplicada',
      }),
      location: new ApproximateLocation({
        latitude: -21.57,
        longitude: -45.45,
        neighborhood: 'Jardim Andere',
        city: 'Varginha',
        region: 'MG',
      }),
      photos: [
        new AnimalPhoto({
          id: 'photo_pipoca',
          animalId: 'anim_4',
          remoteUrl: 'https://images.unsplash.com/photo-1537151608828-ea2b11777ee8',
        }),
      ],
    }),
    new Animal({
      id: 'anim_5',
      ownerId: 'usr_ong_gatinhos',
      name: 'Simba',
      characteristics: new AnimalCharacteristics({
        species: 'Gato',
        size: 'Médio',
        approximateAge: '2 anos',
        sex: 'Macho',
        behavior: 'Dócil, tranquilo, acostumado a viver em apartamento',
        specialCare: 'Castrado e vermifugado',
      }),
      location: new ApproximateLocation({
        latitude: -21.565,
        longitude: -45.438,
        neighborhood: 'Sion',
        city: 'Varginha',
        region: 'MG',
      }),
      photos: [
        new AnimalPhoto({
          id: 'photo_simba',
          animalId: 'anim_5',
          remoteUrl: 'https://images.unsplash.com/photo-1514888286974-6c03e2ca1dba',
        }),
      ],
    }),
    new Animal({
      id: 'anim_6',
      ownerId: 'usr_ong_esperanca',
      name: 'Mel',
      status: AdoptionStatus.adopted(),
      characteristics: new AnimalCharacteristics({
        species: 'Cão',
        size: 'Médio',
        approximateAge: '4 anos',
        sex: 'Fêmea',
        behavior: 'Muito calma, companheira e obediente',
      }),
      location: new ApproximateLocation({
        latitude: -21.552,
        longitude: -45.432,
        neighborhood: 'Centro',
        city: 'Varginha',
        region: 'MG',
      }),
      photos: [
        new AnimalPhoto({
          id: 'photo_mel',
          animalId: 'anim_6',
          remoteUrl: 'https://images.unsplash.com/photo-1583511655857-d19b40a7a54e',
        }),
      ],
    }),
    new Animal({
      id: 'anim_7',
      ownerId: 'usr_1',
      name: 'Bob',
      characteristics: new AnimalCharacteristics({
        species: 'Cão',
        size: 'Grande',
        approximateAge: '5 anos',
        sex: 'Macho',
        behavior: 'Leal, atento e companheiro de caminhadas',
      }),
      location: new ApproximateLocation({
        latitude: -21.562,
        longitude: -45.442,
        neighborhood: 'Vila Paiva',
        city: 'Varginha',
        region: 'MG',
      }),
      photos: [
        new AnimalPhoto({
          id: 'photo_bob',
          animalId: 'anim_7',
          remoteUrl: 'https://images.unsplash.com/photo-1561037404-61cd46aa615b',
        }),
      ],
    }),
  ];
}
