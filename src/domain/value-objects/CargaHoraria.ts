export class CargaHoraria {
  readonly horasTotais: number;
  readonly horasMinimas: number;
  readonly horasPeriodo: number;

  constructor(horasTotais: number, horasMinimas: number, horasPeriodo: number) {
    if (horasTotais < 0 || horasMinimas < 0 || horasPeriodo < 0) {
      throw new Error('Horas não podem ser negativas.');
    }
    if (horasPeriodo > horasTotais) {
      throw new Error('Horas do período não podem exceder horas totais.');
    }
    this.horasTotais = horasTotais;
    this.horasMinimas = horasMinimas;
    this.horasPeriodo = horasPeriodo;
  }

  isAtendida(): boolean {
    return this.horasPeriodo >= this.horasMinimas;
  }
}
