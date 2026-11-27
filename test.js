// Prueba rápida de los cálculos de dinero: node test.js
const assert = require('assert');
const { num, saldoCliente, saldoDeuda, proyeccion, cobrado, vacio } = require('./app.js');

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
// Ingresos del negocio por período (miércoles 11 nov 2026; la semana empieza el lunes 9)
const N = vacio();
N.clientes = [{ movs: [
  { fecha: '2026-10-20', tipo: 'abono', monto: 1 },
  { fecha: '2026-11-02', tipo: 'abono', monto: 10 },
  { fecha: '2026-11-09', tipo: 'abono', monto: 100 },
  { fecha: '2026-11-11', tipo: 'abono', monto: 1000 },
  { fecha: '2026-11-11', tipo: 'deuda', monto: 99999 }, // fiado: no es ingreso
] }];
const mie = new Date(2026, 10, 11);
assert.strictEqual(cobrado(N, 'hoy', mie), 1000);
assert.strictEqual(cobrado(N, 'semana', mie), 1100);
assert.strictEqual(cobrado(N, 'mes', mie), 1110);
assert.strictEqual(cobrado(N, 'todo', mie), 1111);
assert.strictEqual(cobrado(N, 'semana', new Date(2026, 10, 15)), 1100); // domingo sigue siendo la misma semana
console.log('Todo bien ✓');
