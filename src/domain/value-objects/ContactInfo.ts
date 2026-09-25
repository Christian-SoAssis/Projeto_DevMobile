export class ContactInfo {
  readonly email: string;
  readonly phone?: string;

  constructor(email: string, phone?: string) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email || !emailRegex.test(email.trim())) {
      throw new Error('E-mail em formato inválido.');
    }
    this.email = email.trim().toLowerCase();
    this.phone = phone ? phone.trim() : undefined;
  }
}
