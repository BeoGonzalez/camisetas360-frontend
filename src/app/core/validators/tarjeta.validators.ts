import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

/**
 * Validador del algoritmo de Luhn (Módulo 10) para números de tarjeta de crédito/débito.
 */
export function luhnCheck(value: string): boolean {
  if (!value) return false;
  const sanitized = value.replace(/[\s-]/g, '');
  if (!/^\d{13,19}$/.test(sanitized)) {
    return false;
  }

  let sum = 0;
  let alternate = false;

  for (let i = sanitized.length - 1; i >= 0; i--) {
    let n = parseInt(sanitized.charAt(i), 10);
    if (alternate) {
      n *= 2;
      if (n > 9) {
        n -= 9;
      }
    }
    sum += n;
    alternate = !alternate;
  }

  return sum % 10 === 0;
}

/**
 * Angular ValidatorFn para aplicar validación Luhn en un FormControl.
 */
export function luhnValidator(): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    if (!control.value) {
      return null;
    }
    const valido = luhnCheck(control.value);
    return valido ? null : { luhnInvalido: true };
  };
}

/**
 * Comprueba si la fecha de expiración (mes y año) no está vencida.
 */
export function expiracionValida(mes: number, anio: number): boolean {
  if (!mes || !anio || mes < 1 || mes > 12) {
    return false;
  }

  const normalizedYear = anio < 100 ? 2000 + anio : anio;
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;

  if (normalizedYear < currentYear) {
    return false;
  }

  if (normalizedYear === currentYear && mes < currentMonth) {
    return false;
  }

  if (normalizedYear > currentYear + 30) {
    return false;
  }

  return true;
}

/**
 * Angular ValidatorFn para validar que la tarjeta no esté expirada.
 * Puede aplicarse a un FormGroup con controles 'mes' y 'anio' o individualmente.
 */
export function expiracionFormGroupValidator(mesKey = 'mesExpiracion', anioKey = 'anioExpiracion'): ValidatorFn {
  return (group: AbstractControl): ValidationErrors | null => {
    const mes = Number(group.get(mesKey)?.value);
    const anio = Number(group.get(anioKey)?.value);

    if (!mes || !anio) {
      return null; // Deja que los validadores required manejen valores vacíos
    }

    return expiracionValida(mes, anio) ? null : { tarjetaExpirada: true };
  };
}

/**
 * Validador para código de seguridad (CVV/CVC).
 * Admite 3 o 4 dígitos numéricos.
 */
export function cvvValidator(): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    if (!control.value) {
      return null;
    }
    const val = String(control.value).trim();
    const valido = /^\d{3,4}$/.test(val);
    return valido ? null : { cvvInvalido: true };
  };
}

/**
 * Detecta la marca de tarjeta según el prefijo (BIN),
 * alineado con TarjetaUtils.detectarMarca en ms-pago.
 */
export function detectarMarcaTarjeta(numero: string): 'VISA' | 'MASTERCARD' | 'AMEX' | 'OTRA' | 'DESCONOCIDA' {
  const pan = (numero || '').replace(/[\s-]/g, '');
  if (!pan) {
    return 'DESCONOCIDA';
  }
  if (pan.startsWith('4')) {
    return 'VISA';
  }
  if (/^(5[1-5]|2[2-7])/.test(pan)) {
    return 'MASTERCARD';
  }
  if (/^(34|37)/.test(pan)) {
    return 'AMEX';
  }
  return 'OTRA';
}

/**
 * Formatea un número de tarjeta en grupos de 4 dígitos separados por espacios.
 */
export function formatearPan(value: string): string {
  const digits = (value || '').replace(/\D/g, '').slice(0, 19);
  return digits.replace(/(\d{4})(?=\d)/g, '$1 ');
}
