export class Criterio {
  readonly nome: string;
  readonly nota: number;

  constructor(nome: string, nota: number) {
    if (!nome || nome.trim().length === 0) {
      throw new Error('Nome do critério é obrigatório.');
    }
    if (isNaN(nota) || nota < 0 || nota > 10) {
      throw new Error('Nota deve ser um número entre 0 e 10.');
    }
    this.nome = nome.trim();
    this.nota = nota;
  }

  getFaixa(): 'MB' | 'B' | 'R' | 'F' {
    if (this.nota >= 9.0) return 'MB';
    if (this.nota >= 7.0) return 'B';
    if (this.nota >= 5.0) return 'R';
    return 'F';
  }
}
