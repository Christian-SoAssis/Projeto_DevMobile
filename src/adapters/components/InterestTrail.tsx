import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import {
  InterestStatus,
  InterestStatusType,
  INTEREST_TRAIL,
} from '../../domain/value-objects/InterestStatus';

/** Rótulos com acento — a camada de UI decide apresentação; tokens são do VO. */
const TRAIL_LABELS: Record<InterestStatusType, string> = {
  ENVIADA: 'Enviada',
  EM_ANALISE: 'Em análise',
  VISITA_COMBINADA: 'Visita combinada',
  CONCLUIDA: 'Concluída',
  RECUSADA: 'Recusada',
};

export function interestStatusLabel(status: InterestStatus): string {
  return TRAIL_LABELS[status.value];
}

export interface InterestTrailStep {
  label: string;
  done: boolean;
}

/** Puro (testável): 4 passos da trilha com marca até a etapa atual. */
export function interestTrailSteps(status: InterestStatus): InterestTrailStep[] {
  const current = status.stepIndex();
  return INTEREST_TRAIL.map((value, index) => ({
    label: TRAIL_LABELS[value],
    done: current >= index,
  }));
}

export const InterestTrail: React.FC<{
  status: InterestStatus;
  testID?: string;
}> = ({ status, testID = 'interest-trail' }) => {
  const steps = interestTrailSteps(status);
  return (
    <View style={styles.row} testID={testID}>
      {steps.map((step, index) => (
        <View key={step.label} style={styles.segment}>
          <View
            testID={`${testID}-dot-${index + 1}`}
            style={[styles.dot, step.done ? styles.dotDone : styles.dotTodo]}
          />
          <Text
            testID={`${testID}-label-${index + 1}`}
            style={[styles.label, step.done ? styles.labelDone : styles.labelTodo]}
            numberOfLines={1}
          >
            {step.label}
          </Text>
        </View>
      ))}
      {status.isRecusada() && (
        <Text style={styles.refused} testID={`${testID}-recusada`}>
          — Recusada
        </Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    marginTop: 6,
  },
  segment: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 10,
    marginBottom: 4,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 4,
  },
  dotDone: {
    backgroundColor: '#2e7d32',
  },
  dotTodo: {
    backgroundColor: '#d9d9de',
  },
  label: {
    fontSize: 11,
  },
  labelDone: {
    color: '#2e7d32',
    fontWeight: 'bold',
  },
  labelTodo: {
    color: '#8e8e93',
  },
  refused: {
    fontSize: 11,
    color: '#c62828',
    fontWeight: 'bold',
    marginBottom: 4,
  },
});
