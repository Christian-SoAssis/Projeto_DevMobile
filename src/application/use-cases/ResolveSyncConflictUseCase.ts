import { Animal } from '../../domain/entities/Animal';
import { ConflictEvaluationResult, ConflictResolutionService } from '../../domain/services/ConflictResolutionService';

export class ResolveSyncConflictUseCase {
  execute(local: Animal, remote: Animal): ConflictEvaluationResult {
    return ConflictResolutionService.evaluateAnimalConflict(local, remote);
  }
}
