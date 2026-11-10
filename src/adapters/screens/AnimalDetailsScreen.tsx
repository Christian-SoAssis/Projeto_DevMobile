import { loadInterests } from '../../application/use-cases/LoadInterestsUseCase';
import { notifyNotificationsChanged } from '../sync/notificationEvents';
import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert, Share } from 'react-native';
import { Animal } from '../../domain/entities/Animal';
import { AnimalRepository } from '../../domain/ports/AnimalRepository';
import { FavoriteRepository } from '../../domain/ports/FavoriteRepository';
import { AdoptionInterestRepository } from '../../domain/ports/AdoptionInterestRepository';
import { SyncQueueRepository } from '../../domain/ports/SyncQueueRepository';
import { InterestRemoteGateway, RemoteInterest } from '../../domain/ports/InterestRemoteGateway';
import { InterestStatus } from '../../domain/value-objects/InterestStatus';
import { ToggleFavoriteUseCase } from '../../application/use-cases/ToggleFavoriteUseCase';
import { InterestContact, RegisterAdoptionInterestUseCase } from '../../application/use-cases/RegisterAdoptionInterestUseCase';
import { UpdateInterestStatusUseCase } from '../../application/use-cases/UpdateInterestStatusUseCase';
import { MarkAnimalAdoptedUseCase } from '../../application/use-cases/MarkAnimalAdoptedUseCase';
import { GerarPdfUseCase } from '../../application/use-cases/GerarPdfUseCase';
import { AnimalPhotoView } from '../components/AnimalPhotoView';
import { PhotoCarousel } from '../components/PhotoCarousel';
import { PhotoViewer } from '../components/PhotoViewer';
import { InterestTrail, interestStatusLabel } from '../components/InterestTrail';
import { FavoriteRepositoryFake } from '../../application/fakes/FavoriteRepositoryFake';
import { AdoptionInterestRepositoryFake } from '../../application/fakes/AdoptionInterestRepositoryFake';
import { SyncQueueRepositoryFake } from '../../application/fakes/SyncQueueRepositoryFake';
import { UnitOfWork } from '../../application/ports/UnitOfWork';
import { NoopUnitOfWork } from '../../application/fakes/NoopUnitOfWork';
import { AdoptionInterest as InterestEntity } from '../../domain/entities/AdoptionInterest';

export interface AnimalDetailsScreenProps {
  animal: Animal;
  /** `null` = visitante (sem sessão); `undefined` mantém o usuário demo dos testes. */
  currentUserId?: string | null;
  /** Chamado quando um visitante tenta uma ação que exige login. */
  onRequireLogin?: () => void;
  /** Contato do usuário logado, enviado ao responsável junto do interesse. */
  interestContact?: InterestContact;
  /** Leitura dos interesses recebidos (só o responsável enxerga; exige backend). */
  remoteInterests?: InterestRemoteGateway;
  animalRepository: AnimalRepository;
  favoriteRepository?: FavoriteRepository;
  interestRepository?: AdoptionInterestRepository;
  syncQueueRepository?: SyncQueueRepository;
  unitOfWork?: UnitOfWork;
  /** Dispara a sincronização imediata com o Supabase após ações (favorito, interesse, trilha). */
  onSync?: () => Promise<unknown>;
  onBack?: () => void;
}

export const AnimalDetailsScreen: React.FC<AnimalDetailsScreenProps> = ({
  animal: initialAnimal,
  currentUserId = 'usr_2',
  onRequireLogin,
  interestContact,
  remoteInterests,
  animalRepository,
  favoriteRepository = new FavoriteRepositoryFake(),
  interestRepository = new AdoptionInterestRepositoryFake(),
  syncQueueRepository = new SyncQueueRepositoryFake(),
  unitOfWork = new NoopUnitOfWork(),
  onSync,
  onBack,
}) => {
  const [animal, setAnimal] = useState<Animal>(initialAnimal);
  const [isFav, setIsFav] = useState(false);
  const [hasInterest, setHasInterest] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [received, setReceived] = useState<RemoteInterest[] | null>(null);
  const [receivedError, setReceivedError] = useState<string | null>(null);
  // Trilha (decisão 18): lista consolidada de interessados + botão "N interesses".
  const [interestsOpen, setInterestsOpen] = useState(false);
  const [advancingId, setAdvancingId] = useState<string | null>(null);
  // Decisão 16: índice da foto aberta no visualizador (null = fechado).
  const [photoViewerIndex, setPhotoViewerIndex] = useState<number | null>(null);

  const isOwner = currentUserId ? animal.isOwner(currentUserId) : false;

  useEffect(() => {
    async function checkState() {
      // favoriteRepository/interestRepository são singletons estáveis em app/
      // (sharedFakes). Não entram nas deps para não recriar loop quando o
      // default `new ...Fake()` gera nova referência a cada render em testes.
      if (currentUserId) {
        try {
          const fav = await favoriteRepository.isFavorite(currentUserId, animal.id);
          setIsFav(fav);
          const intr = await interestRepository.hasInterest(currentUserId, animal.id);
          setHasInterest(intr);
        } catch {
          // Mantém estado padrão (não favoritado) se a leitura falhar.
        }
      }
    }
    checkState();
  }, [animal.id, currentUserId]);

  // Interesses recebidos: só o responsável lê (RLS `interests_animal_owner_read`).
  useEffect(() => {
    if (!isOwner || !remoteInterests) return;
    let active = true;
    loadInterests(interestRepository, remoteInterests, 'animal', animal.id, syncQueueRepository, () => { if (active) setReceivedError('Não foi possível carregar os interessados agora (sem conexão?).'); })
      .then((list) => {
        if (active) {
          setReceived(list);

        }
      })
      .catch(() => {
        if (active) setReceivedError('Não foi possível carregar os interessados agora (sem conexão?).');
      });
    return () => {
      active = false;
    };
  }, [animal.id, isOwner, remoteInterests]);
  // Trilha (decisão 18): o dono também lê o LOCAL (demo/offline: interesses
  // criados neste aparelho existem só aqui). O LOCAL vira por cima do remoto
  // porque a ação dele é a fonte das mudanças de etapa mais recentes.
  const [localInterests, setLocalInterests] = useState<InterestEntity[]>([]);
  useEffect(() => {
    if (!isOwner) return;
    let active = true;
    interestRepository
      .listByAnimal(animal.id)
      .then((list) => active && setLocalInterests(list))
      .catch(() => active && setLocalInterests([]));
    return () => {
      active = false;
    };
  }, [animal.id, isOwner]);

  const [ownerRows, setOwnerRows] = useState<RemoteInterest[]>([]);
  useEffect(() => {
    // Merge remoto+local por id: remoto traz nome/contato; local (com a etapa
    // acabada de mudar pelas ações do próprio responsável) vence no status.
    // `InterestStatus.from` interpreta legado (PENDING) e remotos.
    const byId = new Map<string, RemoteInterest>();
    for (const r of received ?? []) {
      byId.set(r.id, { ...r, status: r.status ?? 'ENVIADA' });
    }
    for (const l of localInterests) {
      byId.set(l.id, {
        ...(byId.get(l.id) ?? {
          id: l.id,
          userId: l.userId,
          animalId: l.animalId,
          createdAt: l.createdAt,
        }),
        status: byId.get(l.id)?.status ?? l.status.value,
      });
    }
    setOwnerRows(Array.from(byId.values()));
  }, [localInterests, received]);

  // Ação do responsável: avança para a próxima etapa da trilha (ou o botão
  // fica oculto quando a etapa não avança mais — CONCLUÍDA/RECUSADA).
  const handleAdvanceInterest = async (row: RemoteInterest) => {
    const current = InterestStatus.from(row.status);
    const next = current.nextInTrail();
    if (!next) return;
    setAdvancingId(row.id);
    try {
      await new UpdateInterestStatusUseCase(
        interestRepository,
        syncQueueRepository,
        unitOfWork,
        animalRepository
      ).execute(new InterestEntity(row.id, row.userId, row.animalId, row.createdAt, current), next, currentUserId!);
      setLocalInterests(
        localInterests.some((l) => l.id === row.id)
          ? localInterests.map((l) =>
              l.id === row.id ? l.withStatus(next, new Date().toISOString()) : l
            )
          : [
              ...localInterests,
              new InterestEntity(row.id, row.userId, row.animalId, row.createdAt).withStatus(
                next,
                new Date().toISOString()
              ),
            ]
      );
      notifyNotificationsChanged();
      setReceived(rows => rows?.map(r => r.id === row.id ? { ...r, status: next.value } : r) ?? null);
      setFeedback(`Etapa avançada: ${interestStatusLabel(next)}`);
      await onSync?.().catch(() => undefined);
    } catch (err: any) {
      setFeedback(err.message || 'Não foi possível atualizar a etapa.');
    } finally {
      setAdvancingId(null);
    }
  };

  const handleRefuseInterest = async (row: RemoteInterest) => {
    setAdvancingId(row.id);
    try {
      await new UpdateInterestStatusUseCase(
        interestRepository,
        syncQueueRepository,
        unitOfWork,
        animalRepository
      ).execute(new InterestEntity(row.id, row.userId, row.animalId, row.createdAt, InterestStatus.from(row.status)), InterestStatus.recusada(), currentUserId!);
      setLocalInterests(
        localInterests.some((l) => l.id === row.id)
          ? localInterests.map((l) =>
              l.id === row.id ? l.withStatus(InterestStatus.recusada(), new Date().toISOString()) : l
            )
          : [
              ...localInterests,
              new InterestEntity(row.id, row.userId, row.animalId, row.createdAt).withStatus(
                InterestStatus.recusada(),
                new Date().toISOString()
              ),
            ]
      );
      notifyNotificationsChanged();
      setReceived(rows => rows?.map(r => r.id === row.id ? { ...r, status: 'RECUSADA' } : r) ?? null);
      setFeedback('Manifestação recusada.');
      await onSync?.().catch(() => undefined);
    } catch (err: any) {
      setFeedback(err.message || 'Não foi possível recusar a manifestação.');
    } finally {
      setAdvancingId(null);
    }
  };

  const handleToggleFavorite = async () => {
    if (!currentUserId) {
      setFeedback('Faça login para favoritar.');
      onRequireLogin?.();
      return;
    }
    if (isOwner) {
      setFeedback('Você não pode favoritar seu próprio anúncio.');
      return;
    }
    try {
      const useCase = new ToggleFavoriteUseCase(favoriteRepository, syncQueueRepository, unitOfWork);
      const newState = await useCase.execute(currentUserId, animal.id);
      setIsFav(newState);
      setFeedback(newState ? 'Adicionado aos favoritos!' : 'Removido dos favoritos.');
      await onSync?.().catch(() => undefined);
    } catch (err: any) {
      setFeedback(err.message || 'Erro ao favoritar. Tente novamente.');
    }
  };

  const handleDemonstrateInterest = async () => {
    if (!currentUserId) {
      setFeedback('Faça login para demonstrar interesse.');
      onRequireLogin?.();
      return;
    }
    const useCase = new RegisterAdoptionInterestUseCase(interestRepository, syncQueueRepository, unitOfWork);
    await useCase.execute(currentUserId, animal.id, interestContact);
    setHasInterest(true);
    setFeedback('Manifestação de interesse enviada ao responsável!');
    await onSync?.().catch(() => undefined);
  };

  const handleMarkAdopted = async () => {
    if (!currentUserId) {
      onRequireLogin?.();
      return;
    }
    try {
      const useCase = new MarkAnimalAdoptedUseCase(
        animalRepository,
        syncQueueRepository,
        unitOfWork
      );
      const updated = await useCase.execute(currentUserId, animal.id, true);
      setAnimal(updated);
      setFeedback('Animal marcado como adotado com sucesso!');
      await onSync?.().catch(() => undefined);
    } catch (err: any) {
      setFeedback(err.message || 'Erro ao alterar status.');
    }
  };

  const handleExportPdf = () => {
    try {
      const useCase = new GerarPdfUseCase();
      const pdf = useCase.executeForAnimal(animal);
      setFeedback(`PDF gerado com sucesso (${pdf.pdfBase64.substring(0, 30)}...)`);
    } catch (err: any) {
      setFeedback(err.message);
    }
  };

  // Compartilhar (melhoria #6): Share API nativa do RN — texto resumo com o
  // essencial do anúncio + nome do app. Sem deep link/URL inventado: o link
  // real do app entra quando existir store/scheme publicados (decisão de
  // produto registrada em nextsteps §4).
  const handleShare = async () => {
    try {
      const status = animal.status.isAvailable() ? 'Disponível para adoção!' : 'Já encontrou um lar 🎉';
      const message = [
        `${animal.name} — ${status}`,
        `${animal.characteristics.species} · Porte ${animal.characteristics.size} · ${animal.characteristics.approximateAge} · ${animal.characteristics.sex}`,
        `📍 ${animal.location.formatDisplayLocation()}`,
        '',
        'Conheça este e outros anúncios no Enlace — rede de adoção de animais.',
      ].join('\n');
      await Share.share({ title: `Enlace — ${animal.name}`, message });
    } catch (err: any) {
      setFeedback(err.message || 'Não foi possível compartilhar agora.');
    }
  };

  return (
    <ScrollView style={styles.container} testID="animal-details-screen">
      {onBack && (
        <TouchableOpacity style={styles.backButton} onPress={onBack} testID="back-button">
          <Text style={styles.backText}>← Voltar</Text>
        </TouchableOpacity>
      )}

      {/* Fotos em destaque (RF09/decisão 16): ≥ 1 foto → carrossel com todas
          (toque abre o visualizador em tela cheia com zoom); 0 fotos →
          placeholder, como sempre. Resolução local-primeiro (AnimalPhotoView). */}
      {animal.photos.length > 0 ? (
        <PhotoCarousel
          testID="animal-photo-carousel"
          height={200}
          pages={animal.photos.map((photo, index) => ({
            photo,
            testID: index === 0 ? 'animal-photo' : `animal-photo-${index + 1}`,
            onPress: () => setPhotoViewerIndex(index),
          }))}
        />
      ) : (
        <AnimalPhotoView
          photo={null}
          testID="animal-photo"
          style={styles.photoHero}
        />
      )}

      {/* Decisão 16: qualquer foto abre em tela cheia com zoom (pinça 1x–4x)
          e deslizar entre as fotos; ✕/voltar fecha. */}
      <PhotoViewer
        visible={photoViewerIndex !== null}
        initialIndex={photoViewerIndex ?? 0}
        pages={animal.photos.map((photo) => ({ photo }))}
        onClose={() => setPhotoViewerIndex(null)}
      />

      {feedback && (
        <View style={styles.feedbackBanner} testID="feedback-message">
          <Text style={styles.feedbackText}>{feedback}</Text>
        </View>
      )}

      <View style={styles.header}>
        <Text style={styles.title} testID="animal-title">{animal.name}</Text>
        <View style={[styles.badge, animal.status.isAdopted() ? styles.badgeAdopted : styles.badgeAvailable]}>
          <Text style={styles.badgeText}>{animal.status.isAdopted() ? 'Adotado' : 'Disponível'}</Text>
        </View>
      </View>

      <Text style={styles.sectionHeader}>Características</Text>
      <View style={styles.infoCard}>
        <Text style={styles.infoLine} testID="info-species">Espécie: {animal.characteristics.species}</Text>
        <Text style={styles.infoLine} testID="info-size">Porte: {animal.characteristics.size}</Text>
        <Text style={styles.infoLine} testID="info-age">Idade aproximada: {animal.characteristics.approximateAge}</Text>
        <Text style={styles.infoLine} testID="info-sex">Sexo: {animal.characteristics.sex}</Text>
        {!!animal.characteristics.behavior && (
          <Text style={styles.infoLine}>Comportamento: {animal.characteristics.behavior}</Text>
        )}
        {!!animal.characteristics.specialCare && (
          <Text style={styles.infoLine}>Cuidados especiais: {animal.characteristics.specialCare}</Text>
        )}
      </View>

      <Text style={styles.sectionHeader}>Localização Aproximada</Text>
      <View style={styles.infoCard}>
        <Text style={styles.infoLine} testID="approx-location">
          📍 {animal.location.formatDisplayLocation()}
        </Text>
        <Text style={styles.privacyNote}>* Endereço residencial exato não é exposto por privacidade.</Text>
      </View>

      {/* Action Buttons */}
      <View style={styles.actionSection}>
        <TouchableOpacity
          style={[styles.btn, isFav ? styles.btnFavActive : styles.btnFav]}
          onPress={handleToggleFavorite}
          testID="favorite-button"
        >
          <Text style={styles.btnText}>{isFav ? '❤️ Favoritado' : '🤍 Salvar nos Favoritos'}</Text>
        </TouchableOpacity>

        {!isOwner && animal.status.isAvailable() && (
          <TouchableOpacity
            style={[styles.btn, hasInterest ? styles.btnDisabled : styles.btnPrimary]}
            onPress={handleDemonstrateInterest}
            disabled={hasInterest}
            testID="interest-button"
          >
            <Text style={styles.btnText}>
              {hasInterest ? 'Interesse Registrado' : '🤝 Demonstrar Interesse'}
            </Text>
          </TouchableOpacity>
        )}

        {isOwner && animal.status.isAvailable() && (
          <TouchableOpacity
            style={[styles.btn, styles.btnSuccess]}
            onPress={handleMarkAdopted}
            testID="mark-adopted-button"
          >
            <Text style={styles.btnText}>🎉 Marcar como Adotado</Text>
          </TouchableOpacity>
        )}

        {/* Trilha de adoção (decisão 18): o botão "N interesses" abre a lista
            com o contato do interessado, a trilha de 4 etapas e as ações de
            avanço/recusa no contexto do anúncio. */}
        {isOwner && (
          <TouchableOpacity
            style={[styles.btn, styles.btnSecondary]}
            onPress={() => setInterestsOpen((open) => !open)}
            testID="interests-toggle"
          >
            <Text style={styles.btnText}>
              {ownerRows.length > 0
                ? `${ownerRows.length} interesses`
                : '0 interesses'}
            </Text>
          </TouchableOpacity>
        )}

        {isOwner && interestsOpen && (
          <View style={styles.interestsBox} testID="received-interests">
            {receivedError && <Text style={styles.interestsEmpty} testID="received-interests-error">{receivedError}</Text>}
            {ownerRows.length === 0 && !receivedError && (
              <Text style={styles.interestsEmpty} testID="received-interests-empty">
                Ninguém demonstrou interesse ainda.
              </Text>
            )}
            {ownerRows.map((row) => {
              const status = InterestStatus.from(row.status);
              const next = status.nextInTrail();
              return (
                <View key={row.id} style={styles.interestCard} testID={`received-interest-${row.id}`}>
                  <Text style={styles.interestName}>{row.contactName || 'Interessado'}</Text>
                  {row.contactPhone ? <Text style={styles.interestLine}>Telefone: {row.contactPhone}</Text> : null}
                  {row.contactEmail ? <Text style={styles.interestLine}>E-mail: {row.contactEmail}</Text> : null}
                  {row.message ? <Text style={styles.interestLine}>{row.message}</Text> : null}
                  <InterestTrail status={status} testID={`interest-trail-${row.id}`} />
                  {(next || (status.stepIndex() <= 1 && !status.isRecusada())) && (
                    <View style={styles.interestActions}>
                      {next && (
                        <TouchableOpacity
                          style={[styles.interestActionBtn, styles.interestAdvance]}
                          disabled={advancingId === row.id}
                          onPress={() => handleAdvanceInterest(row)}
                          testID={`interest-advance-${row.id}`}
                        >
                          <Text style={styles.interestActionText}>
                            {advancingId === row.id ? '…' : `Avançar: ${interestStatusLabel(next)}`}
                          </Text>
                        </TouchableOpacity>
                      )}
                      {status.stepIndex() <= 1 && !status.isRecusada() && (
                        <TouchableOpacity
                          style={[styles.interestActionBtn, styles.interestRefuse]}
                          disabled={advancingId === row.id}
                          onPress={() => handleRefuseInterest(row)}
                          testID={`interest-refuse-${row.id}`}
                        >
                          <Text style={[styles.interestActionText, styles.interestRefuseText]}>
                            Recusar
                          </Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  )}
                </View>
              );
            })}
          </View>
        )}

        <TouchableOpacity style={[styles.btn, styles.btnSecondary]} onPress={handleShare} testID="share-animal-button">
          <Text style={styles.btnText}>📤 Compartilhar Anúncio</Text>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.btn, styles.btnSecondary]} onPress={handleExportPdf} testID="export-pdf-button">
          <Text style={styles.btnText}>📄 Gerar PDF do Anúncio</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  photoHero: {
    height: 200,
    marginBottom: 16,
  },
  interestsBox: { marginTop: 8, marginBottom: 8 },
  interestsTitle: { fontSize: 16, fontWeight: 'bold', color: '#1c1c1e', marginBottom: 8 },
  interestsEmpty: { color: '#8e8e93', marginBottom: 8 },
  interestCard: { backgroundColor: '#fff', borderRadius: 8, padding: 12, marginBottom: 8 },
  interestName: { fontWeight: 'bold', color: '#1c1c1e', marginBottom: 2 },
  interestLine: { color: '#48484a', fontSize: 14 },
  interestActions: { flexDirection: 'row', marginTop: 8 },
  interestActionBtn: {
    flex: 1,
    borderRadius: 6,
    paddingVertical: 8,
    alignItems: 'center',
    marginRight: 8,
  },
  interestAdvance: { backgroundColor: '#0066cc' },
  interestRefuse: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#c62828', marginRight: 0 },
  interestActionText: { color: '#fff', fontWeight: 'bold', fontSize: 13 },
  interestRefuseText: { color: '#c62828' },
  container: {
    flex: 1,
    flexDirection: 'column',
    backgroundColor: '#f5f5f7',
    padding: 16,
  },
  backButton: {
    marginBottom: 12,
  },
  backText: {
    fontSize: 16,
    color: '#0066cc',
    fontWeight: 'bold',
  },
  feedbackBanner: {
    backgroundColor: '#d1ecf1',
    padding: 10,
    borderRadius: 6,
    marginBottom: 12,
  },
  feedbackText: {
    color: '#0c5460',
    fontSize: 14,
    fontWeight: 'bold',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1c1c1e',
  },
  badge: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
  },
  badgeAvailable: {
    backgroundColor: '#28a745',
  },
  badgeAdopted: {
    backgroundColor: '#6c757d',
  },
  badgeText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 14,
  },
  sectionHeader: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#3a3a3c',
    marginTop: 12,
    marginBottom: 8,
  },
  infoCard: {
    backgroundColor: '#fff',
    padding: 14,
    borderRadius: 8,
    marginBottom: 12,
    borderColor: '#e5e5ea',
    borderWidth: 1,
  },
  infoLine: {
    fontSize: 14,
    color: '#333',
    marginBottom: 6,
  },
  privacyNote: {
    fontSize: 12,
    color: '#8e8e93',
    fontStyle: 'italic',
    marginTop: 4,
  },
  actionSection: {
    marginTop: 16,
    marginBottom: 32,
  },
  btn: {
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 10,
  },
  btnPrimary: {
    backgroundColor: '#0066cc',
  },
  btnSuccess: {
    backgroundColor: '#28a745',
  },
  btnFav: {
    backgroundColor: '#6c757d',
  },
  btnFavActive: {
    backgroundColor: '#dc3545',
  },
  btnSecondary: {
    backgroundColor: '#17a2b8',
  },
  btnDisabled: {
    backgroundColor: '#a5a5a5',
  },
  btnText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: 'bold',
  },
});
