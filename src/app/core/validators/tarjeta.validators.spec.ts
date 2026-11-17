import { describe, it, expect } from 'vitest';
import { FormControl, FormGroup } from '@angular/forms';
import {
  luhnCheck,
  luhnValidator,
  expiracionValida,
  expiracionFormGroupValidator,
  cvvValidator,
  detectarMarcaTarjeta,
  formatearPan,
  esTarjetaPruebaTransbank,
  TARJETAS_PRUEBA_TRANSBANK,
} from './tarjeta.validators';

describe('tarjeta.validators', () => {
  describe('luhnCheck & luhnValidator', () => {
    it('debe validar números de tarjeta válidos (algoritmo Luhn)', () => {
      // Tarjetas válidas de prueba
      expect(luhnCheck('4532015112830366')).toBe(true);
      expect(luhnCheck('4532 0151 1283 0366')).toBe(true);
      expect(luhnCheck('4532-0151-1283-0366')).toBe(true);
    });

    it('debe invalidar números con dígito verificador incorrecto', () => {
      expect(luhnCheck('4532015112830367')).toBe(false);
      expect(luhnCheck('1234567812345678')).toBe(false);
      expect(luhnCheck('')).toBe(false);
      expect(luhnCheck('abcd')).toBe(false);
    });

    it('luhnValidator debe retornar null si es válido y error si es inválido', () => {
      const validator = luhnValidator();
      const validControl = new FormControl('4532015112830366');
      const invalidControl = new FormControl('4532015112830367');
      const emptyControl = new FormControl('');

      expect(validator(validControl)).toBeNull();
      expect(validator(invalidControl)).toEqual({ luhnInvalido: true });
      expect(validator(emptyControl)).toBeNull(); // control vacío no falla luhn (eso lo hace required)
    });
  });

  describe('tarjetas de prueba de Transbank (las que reconoce ms-pagos)', () => {
    const aceptaPrueba = luhnValidator({ aceptarTarjetasPrueba: true });

    it('son exactamente las 8 documentadas, con su resultado esperado', () => {
      expect(TARJETAS_PRUEBA_TRANSBANK.map((t) => [t.numero, t.autorizada])).toEqual([
        ['4051885600446623', true],
        ['370000000002032', true],
        ['5186059559590568', false],
        ['4051884239937763', true],
        ['4511346660037060', true],
        ['5186008541233829', false],
        ['4051886000056590', true],
        ['5186174110629480', false],
      ]);
    });

    it.each(TARJETAS_PRUEBA_TRANSBANK.map((t) => [t.tipo, t.numero] as const))(
      '%s %s es aceptada por el formulario (con y sin espacios)',
      (_tipo, numero) => {
        expect(aceptaPrueba(new FormControl(numero))).toBeNull();
        expect(aceptaPrueba(new FormControl(formatearPan(numero)))).toBeNull();
      },
    );

    it('Redcompra 4511 3466 6003 7060 NO pasa Luhn: solo se acepta por ser de prueba', () => {
      expect(luhnCheck('4511346660037060')).toBe(false);
      expect(luhnValidator()(new FormControl('4511346660037060'))).toEqual({ luhnInvalido: true });
      expect(esTarjetaPruebaTransbank('4511 3466 6003 7060')).toBe(true);
    });

    it('la excepción no abre la puerta a otros números inválidos', () => {
      expect(aceptaPrueba(new FormControl('4511346660037062'))).toEqual({ luhnInvalido: true });
      expect(aceptaPrueba(new FormControl('1234567812345678'))).toEqual({ luhnInvalido: true });
    });

    it.each([
      ['4051885600446623', 'VISA'],
      ['370000000002032', 'AMEX'],
      ['5186059559590568', 'MASTERCARD'],
      ['4511346660037060', 'VISA'],
    ])('detecta la marca de %s como %s', (numero, marca) => {
      expect(detectarMarcaTarjeta(numero)).toBe(marca);
    });

    it('AMEX de 15 dígitos se agrupa sin perder dígitos', () => {
      expect(formatearPan('370000000002032').replace(/\s/g, '')).toBe('370000000002032');
    });
  });

  describe('expiracionValida & expiracionFormGroupValidator', () => {
    it('debe permitir fechas futuras', () => {
      const now = new Date();
      const nextYear = now.getFullYear() + 2;
      expect(expiracionValida(12, nextYear)).toBe(true);
      expect(expiracionValida(now.getMonth() + 1, now.getFullYear())).toBe(true);
    });

    it('debe rechazar fechas pasadas o meses inválidos', () => {
      const now = new Date();
      expect(expiracionValida(1, now.getFullYear() - 1)).toBe(false);
      expect(expiracionValida(13, 2028)).toBe(false);
      expect(expiracionValida(0, 2028)).toBe(false);
    });

    it('expiracionFormGroupValidator debe validar el grupo de formulario', () => {
      const validator = expiracionFormGroupValidator('mes', 'anio');
      const groupValido = new FormGroup({
        mes: new FormControl(12),
        anio: new FormControl(new Date().getFullYear() + 2),
      });
      const groupExpirado = new FormGroup({
        mes: new FormControl(1),
        anio: new FormControl(2020),
      });

      expect(validator(groupValido)).toBeNull();
      expect(validator(groupExpirado)).toEqual({ tarjetaExpirada: true });
    });
  });

  describe('cvvValidator', () => {
    it('debe aceptar 3 o 4 dígitos', () => {
      const validator = cvvValidator();
      expect(validator(new FormControl('123'))).toBeNull();
      expect(validator(new FormControl('1234'))).toBeNull();
    });

    it('debe rechazar menos de 3, más de 4 o caracteres no numéricos', () => {
      const validator = cvvValidator();
      expect(validator(new FormControl('12'))).toEqual({ cvvInvalido: true });
      expect(validator(new FormControl('12345'))).toEqual({ cvvInvalido: true });
      expect(validator(new FormControl('12a'))).toEqual({ cvvInvalido: true });
    });
  });

  describe('detectarMarcaTarjeta', () => {
    it('debe detectar VISA cuando inicia con 4', () => {
      expect(detectarMarcaTarjeta('4532015112830366')).toBe('VISA');
    });

    it('debe detectar MASTERCARD cuando inicia con 51-55 o 22-27', () => {
      expect(detectarMarcaTarjeta('5555555555554444')).toBe('MASTERCARD');
      expect(detectarMarcaTarjeta('2221000000000000')).toBe('MASTERCARD');
    });

    it('debe detectar AMEX cuando inicia con 34 o 37', () => {
      expect(detectarMarcaTarjeta('378282246310005')).toBe('AMEX');
      expect(detectarMarcaTarjeta('348282246310005')).toBe('AMEX');
    });

    it('debe devolver OTRA o DESCONOCIDA según corresponda', () => {
      expect(detectarMarcaTarjeta('6011000000000000')).toBe('OTRA');
      expect(detectarMarcaTarjeta('')).toBe('DESCONOCIDA');
    });
  });

  describe('formatearPan', () => {
    it('debe agrupar los dígitos en bloques de 4', () => {
      expect(formatearPan('4532015112830366')).toBe('4532 0151 1283 0366');
      expect(formatearPan('45320151')).toBe('4532 0151');
      expect(formatearPan('')).toBe('');
    });
  });
});
