// Prueba rápida de los cálculos de dinero: node test.js
const assert = require('assert');
const { num, saldoCliente, saldoDeuda, proyeccion, vacio } = require('./app.js');

assert.strictEqual(num('15000'), 15000);
assert.strictEqual(num('15.000'), 15000);
assert.strictEqual(num('$ 1.250.000'), 1250000);
assert.strictEqual(num('2,5'), 2.5);
assert.strictEqual(num('2.5'), 2.5);
assert.ok(Number.isNaN(num('')));
assert.ok(Number.isNaN(num('-5')));
assert.ok(Number.isNaN(num('abc')));

assert.strictEqual(saldoCliente({ movs: [{ tipo: 'deuda', monto: 5000 }, { tipo: 'abono', monto: 2000 }] }), 3000);
assert.strictEqual(saldoDeuda({ monto: 100, abonos: [{ monto: 30 }] }), 70);

const D = vacio();
D.banco = 1000; D.efectivo = 500;
D.movs = [
  { fecha: '2026-11-05', tipo: 'gasto', cat: 'Comida', monto: 100 },
  { fecha: '2026-11-08', tipo: 'gasto', cat: 'Comida', monto: 100 },
  { fecha: '2026-11-09', tipo: 'ingreso', cat: 'Sueldo', monto: 900 },
  { fecha: '2026-10-30', tipo: 'gasto', cat: 'Otros', monto: 9999 }, // otro mes: no cuenta
];
const p = proyeccion(D, new Date(2026, 10, 10)); // 10 de noviembre, faltan 20 días
assert.strictEqual(p.gastos, 200);
assert.strictEqual(p.ingresos, 900);
assert.strictEqual(p.restantes, 20);
assert.strictEqual(p.final, 1500 - 20 * 20);
assert.deepStrictEqual(p.porCat, { Comida: 200 });
console.log('Todo bien ✓');
