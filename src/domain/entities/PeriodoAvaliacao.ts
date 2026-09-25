import { StatusPeriodo } from '../value-objects/StatusPeriodo';
import { Assinatura } from '../value-objects/Assinatura';
import { Criterio } from '../value-objects/Criterio';

export interface AtividadeDesenvolvida {
  id: string;
  descricao: string;
  horas: number;
}

export interface PeriodoAvaliacaoProps {
  id: string;
  estagioId: string;
  alunoId: string;
  atividades?: AtividadeDesenvolvida[];
  criteriosAvaliacao?: Criterio[];
  autoAvaliacao?: Criterio[];
  assinaturas?: Assinatura[];
  status?: StatusPeriodo;
}

export class PeriodoAvaliacao {
  readonly id: string;
  readonly estagioId: string;
  readonly alunoId: string;
  private _atividades: AtividadeDesenvolvida[];
  private _criteriosAvaliacao: Criterio[];
  private _autoAvaliacao: Criterio[];
  private _assinaturas: Assinatura[];
  private _status: StatusPeriodo;

  constructor(props: PeriodoAvaliacaoProps) {
    if (!props.id) throw new Error('ID do período de avaliação é obrigatório.');
    if (!props.estagioId) throw new Error('ID do estágio é obrigatório.');
    if (!props.alunoId) throw new Error('ID do aluno é obrigatório.');

    this.id = props.id;
    this.estagioId = props.estagioId;
    this.alunoId = props.alunoId;
    this._atividades = props.atividades || [];
    this._criteriosAvaliacao = props.criteriosAvaliacao || [];
    this._autoAvaliacao = props.autoAvaliacao || [];
    this._assinaturas = props.assinaturas || [];
    this._status = props.status || new StatusPeriodo('RASCUNHO');
  }

  get atividades(): readonly AtividadeDesenvolvida[] {
    return this._atividades;
  }

  get criteriosAvaliacao(): readonly Criterio[] {
    return this._criteriosAvaliacao;
  }

  get autoAvaliacao(): readonly Criterio[] {
    return this._autoAvaliacao;
  }

  get assinaturas(): readonly Assinatura[] {
    return this._assinaturas;
  }

  get status(): StatusPeriodo {
    return this._status;
  }

  adicionarAtividade(atividade: AtividadeDesenvolvida): void {
    if (this._status.isAprovado()) {
      throw new Error('Não é possível alterar um período já APROVADO.');
    }
    this._atividades.push(atividade);
  }

  registrarAvaliacaoSupervisor(criterios: Criterio[]): void {
    if (this._status.isAprovado()) {
      throw new Error('Não é possível registrar 2ª avaliação em um período já APROVADO.');
    }
    this._criteriosAvaliacao = criterios;
  }

  registrarAutoAvaliacao(criterios: Criterio[]): void {
    if (this._status.isAprovado()) {
      throw new Error('Não é possível alterar autoavaliação em um período já APROVADO.');
    }
    this._autoAvaliacao = criterios;
  }

  adicionarAssinatura(assinatura: Assinatura): void {
    if (!assinatura.isValid()) {
      throw new Error('Assinatura digital inválida.');
    }
    this._assinaturas.push(assinatura);
  }

  aprovar(): void {
    if (this._assinaturas.length === 0) {
      throw new Error('Para aprovar o período é necessária ao menos uma assinatura.');
    }
    this._status = new StatusPeriodo('APROVADO');
  }

  devolver(): void {
    this._status = new StatusPeriodo('DEVOLVIDO');
  }

  podeGerarPdf(): boolean {
    return (
      this._atividades.length > 0 &&
      this._assinaturas.length >= 1 &&
      this._assinaturas.every((a) => a.isValid())
    );
  }
}
