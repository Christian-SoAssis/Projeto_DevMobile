import { Animal } from '../../domain/entities/Animal';
import { AnimalPhoto } from '../../domain/entities/AnimalPhoto';
import { AdoptionStatus } from '../../domain/value-objects/AdoptionStatus';
import { AnimalCharacteristics } from '../../domain/value-objects/AnimalCharacteristics';
import { ApproximateLocation } from '../../domain/value-objects/ApproximateLocation';

/**
 * Seed inicial de animais com UUIDs válidos (mesmos IDs sincronizados no Supabase).
 * Garante que o cache local nunca inicie vazio mesmo na primeira abertura sem rede (RNF01).
 */
export function buildSeedAnimals(): Animal[] {
  return [
    new Animal({
      id: '11111111-1111-4111-8111-000000000001',
      ownerId: '76f32386-096a-48a3-ab72-ee732b7ce99e',
      name: 'Luna',
      characteristics: new AnimalCharacteristics({
        species: 'Cão',
        size: 'Médio',
        approximateAge: '2 anos',
        sex: 'Fêmea',
        characteristics: 'Pelagem dourada e branca, porte atlético',
        behavior: 'Carinhosa e pronta para uma nova história. Muito dócil e brincalhona.',
        specialCare: 'Castrada e com vacinas em dia',
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
          id: '22222222-2222-4222-8222-000000000001',
          animalId: '11111111-1111-4111-8111-000000000001',
          remoteUrl: 'https://images.unsplash.com/photo-1543466835-00a7907e9de1',
        }),
      ],
    }),
    new Animal({
      id: '11111111-1111-4111-8111-000000000002',
      ownerId: '76f32386-096a-48a3-ab72-ee732b7ce99e',
      name: 'Nino',
      characteristics: new AnimalCharacteristics({
        species: 'Gato',
        size: 'Médio',
        approximateAge: '1 ano',
        sex: 'Macho',
        characteristics: 'Tigrado laranja, olhos verdes expressivos',
        behavior: 'Calmo, carinhoso e acostumado com apartamento.',
        specialCare: 'Castrado e vermifugado',
      }),
      location: new ApproximateLocation({
        latitude: -21.56,
        longitude: -45.44,
        neighborhood: 'Centro',
        city: 'Varginha',
        region: 'MG',
      }),
      photos: [
        new AnimalPhoto({
          id: '22222222-2222-4222-8222-000000000002',
          animalId: '11111111-1111-4111-8111-000000000002',
          remoteUrl: 'https://images.unsplash.com/photo-1514888286974-6c03e2ca1dba',
        }),
      ],
    }),
    new Animal({
      id: '11111111-1111-4111-8111-000000000003',
      ownerId: '5d7be086-494a-4f11-b45e-347900453e59',
      name: 'Mel',
      status: AdoptionStatus.available(),
      characteristics: new AnimalCharacteristics({
        species: 'Cão',
        size: 'Grande',
        approximateAge: '3 anos',
        sex: 'Fêmea',
        characteristics: 'Caramelo, olhar doce e muito companheira',
        behavior: 'Muito calma, obediente e ótima com crianças.',
        specialCare: 'Vacinada e microchipada',
      }),
      location: new ApproximateLocation({
        latitude: -21.57,
        longitude: -45.45,
        neighborhood: 'Vila Paiva',
        city: 'Varginha',
        region: 'MG',
      }),
      photos: [
        new AnimalPhoto({
          id: '22222222-2222-4222-8222-000000000003',
          animalId: '11111111-1111-4111-8111-000000000003',
          remoteUrl: 'https://images.unsplash.com/photo-1552053831-71594a27632d',
        }),
      ],
    }),
  ];
}
