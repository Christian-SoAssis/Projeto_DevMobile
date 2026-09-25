export class Estagio {
  readonly id: string;
  readonly alunoId: string;
  readonly supervisorId: string;
  readonly empresa: string;
  readonly dataInicio: string;

  constructor(id: string, alunoId: string, supervisorId: string, empresa: string, dataInicio?: string) {
    if (!id) throw new Error('ID do estágio é obrigatório.');
    if (!alunoId) throw new Error('ID do aluno é obrigatório.');
    if (!supervisorId) throw new Error('ID do supervisor é obrigatório.');

    this.id = id;
    this.alunoId = alunoId;
    this.supervisorId = supervisorId;
    this.empresa = empresa || 'Empresa Parceira';
    this.dataInicio = dataInicio || new Date().toISOString();
  }
}
