import React, { useState, useEffect } from 'react';
import { Text, StyleSheet, TouchableOpacity, View } from 'react-native';
import { AnimalRepository } from '../../domain/ports/AnimalRepository';
import { User } from '../../domain/entities/User';

/**
 * Progress card de onboarding na Home (melhoria #12, decisão 08/11/2026):
 * os passos derivam de DADOS REAIS do User (foto, telefone, bio, interesses)
 * + o primeiro anúncio publicado — card que substitui tutorial modal,
 * clássico "progress card pinned to home". Some quando o perfil está completo
 * e NÃO aparece para visitante (sem sessão). Navegar por 1 toque leva ao
 * próximo passo (Conta para dados, formulário para o anúncio).
 */

export interface OnboardingStep {
  id: 'avatar' | 'phone' | 'bio' | 'interests' | 'listing';
  label: string;
  done: boolean;
}

/** Puro: facilita comparar (e testar) passos derivados do estado do usuário. */
export function computeOnboardingSteps(user: User | null, firstListingDone: boolean): OnboardingStep[] {
  if (!user) return [];
  return [
    { id: 'avatar', label: 'Perfil com foto', done: !!(user.avatarUri || user.avatarUrl) },
    {
      id: 'phone',
      label: 'Telefone para os interessados',
      done: !!user.contactInfo?.phone,
    },
    { id: 'bio', label: 'Mini bio no perfil', done: !!user.bio && user.bio.trim().length > 0 },
    { id: 'interests', label: 'Preferências marcadas', done: user.interests.length > 0 },
    { id: 'listing', label: 'Primeiro anúncio publicado', done: firstListingDone },
  ];
}

const NEXT_CTA_LABELS: Record<OnboardingStep['id'], string> = {
  avatar: 'Completar dados do perfil',
  phone: 'Cadastrar telefone',
  bio: 'Completar dados do perfil',
  interests: 'Marcar preferências',
  listing: 'Publicar primeiro anúncio',
};

export interface OnboardingProgressCardProps {
  refreshToken?: number;
  user: User | null;
  animalRepository?: AnimalRepository;
  /** Fluxos do próximo passo (Conta ou formulário de anúncio). */
  onGoToAccount?: () => void;
  onNewAnimal?: () => void;
}

export const OnboardingProgressCard: React.FC<OnboardingProgressCardProps> = ({
  refreshToken = 0,
  user,
  animalRepository,
  onGoToAccount,
  onNewAnimal,
}) => {
  const [firstListingDone, setFirstListingDone] = useState(false);

  useEffect(() => {
    if (!user || !animalRepository) return;
    let active = true;
    animalRepository
      .listByOwner(user.id)
      .then((list) => {
        if (active) setFirstListingDone(list.length > 0);
      })
      .catch(() => {
        if (active) setFirstListingDone(false); // falha de leitura ≠ bloquear o card
      });
    return () => {
      active = false;
    };
  }, [user, animalRepository, refreshToken]);

  // Visitante: sem card (não empuja cadastro na primeira sessão).
  if (!user) return null;

  const steps = computeOnboardingSteps(user, firstListingDone);
  const doneCount = steps.filter((s) => s.done).length;

  // Perfil completo: sem card — não rivaliza com a lista de anúncios.
  if (doneCount === steps.length) return null;

  const next = steps.find((s) => !s.done)!;
  const onPressNext = next.id === 'listing' ? onNewAnimal : onGoToAccount;

  return (
    <View style={styles.card} testID="onboarding-card">
      <Text style={styles.title} testID="onboarding-card-title">
        Complete seu perfil — {doneCount}/{steps.length}
      </Text>
      {steps.map((step) => (
        <Text
          key={step.id}
          style={[styles.step, step.done ? styles.stepDone : styles.stepTodo]}
          testID={`onboarding-step-${step.id}`}
        >
          {step.done ? '✔' : '○'} {step.label}
        </Text>
      ))}
      {onPressNext && (
        <TouchableOpacity
          style={styles.btn}
          onPress={onPressNext}
          testID={`onboarding-next-${next.id}`}
        >
          <Text style={styles.btnText}>{NEXT_CTA_LABELS[next.id]}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#eef4ff',
    borderRadius: 10,
    padding: 14,
    marginBottom: 10,
    borderColor: '#c9dbff',
    borderWidth: 1,
  },
  title: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#1c1c1e',
    marginBottom: 6,
  },
  step: {
    fontSize: 13,
    marginTop: 2,
  },
  stepDone: {
    color: '#2e7d32',
  },
  stepTodo: {
    color: '#5b6773',
  },
  btn: {
    backgroundColor: '#0066cc',
    borderRadius: 8,
    paddingVertical: 10,
    marginTop: 10,
    alignItems: 'center',
  },
  btnText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 14,
  },
});
