// ---------- Datos ----------
const KEY = 'misFinanzas.v1';
const vacio = () => ({ clientes: [], banco: 0, efectivo: 0, deudas: [], movs: [] });
const CATS = {
  gasto: ['Comida', 'Transporte', 'Casa / arriendo', 'Servicios', 'Celular / internet', 'Salud', 'Ropa', 'Diversión', 'Mercancía del negocio', 'Otros'],
  ingreso: ['Sueldo', 'Ventas del colegio', 'Cobros a clientes', 'Regalo', 'Otros'],
};
const CUENTAS = [['efectivo', 'Efectivo'], ['banco', 'Banco']];

// ---------- Cálculos (sin pantalla, se prueban en test.js) ----------
const suma = (arr, f) => arr.reduce((s, x) => s + f(x), 0);
const saldoCliente = c => suma(c.movs, m => (m.tipo === 'deuda' ? m.monto : -m.monto));
const saldoDeuda = d => d.monto - suma(d.abonos, a => a.monto);
const fechaISO = (d = new Date()) => d.toLocaleDateString('en-CA'); // AAAA-MM-DD en hora local

// Acepta "15000", "15.000", "15000,50", "$ 15.000"
function num(s) {
  s = String(s).trim().replace(/[\s$]/g, '');
  if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
  else if (/^\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, '');
  const n = s === '' ? NaN : Number(s);
  return Number.isFinite(n) && n >= 0 ? n : NaN;
}

function proyeccion(D, fecha = new Date()) {
  const mes = fechaISO(fecha).slice(0, 7);
  const delMes = D.movs.filter(m => m.fecha.startsWith(mes));
  const ingresos = suma(delMes.filter(m => m.tipo === 'ingreso'), m => m.monto);
  const gastos = suma(delMes.filter(m => m.tipo === 'gasto'), m => m.monto);
  const dia = fecha.getDate();
  const diasMes = new Date(fecha.getFullYear(), fecha.getMonth() + 1, 0).getDate();
  const restantes = diasMes - dia;
  const gastoDiario = gastos / dia;
  const actual = D.banco + D.efectivo;
  const porCat = {};
  delMes.filter(m => m.tipo === 'gasto').forEach(m => (porCat[m.cat] = (porCat[m.cat] || 0) + m.monto));
  // shortcut: asume que seguirás gastando al mismo ritmo diario y sin más ingresos; no conoce pagos fijos futuros
  return { ingresos, gastos, gastoDiario, actual, restantes, final: actual - gastoDiario * restantes, porCat };
}

if (typeof module !== 'undefined') module.exports = { num, saldoCliente, saldoDeuda, proyeccion, vacio };

// ---------- Pantalla ----------
let D;
function cargar() {
  try { return Object.assign(vacio(), JSON.parse(localStorage.getItem(KEY))); }
  catch { return vacio(); }
}
function guardar() {
  localStorage.setItem(KEY, JSON.stringify(D));
  render();
}

const $ = id => document.getElementById(id);
const fmt = n => (n < 0 ? '−$' : '$') + Math.abs(n).toLocaleString('es-CO', { maximumFractionDigits: Math.abs(n) >= 1000 ? 0 : 2 });
const bonita = f => new Date(f + 'T00:00').toLocaleDateString('es', { day: 'numeric', month: 'short', year: 'numeric' });
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => '&#' + c.charCodeAt(0) + ';');
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

function tab(nombre) {
  document.querySelectorAll('.vista').forEach(v => (v.hidden = v.id !== nombre));
  document.querySelectorAll('nav button').forEach(b => b.classList.toggle('activo', b.dataset.tab === nombre));
  $('titulo').textContent = { negocio: 'Negocio del colegio', personal: 'Mis cuentas', copia: 'Copia de seguridad' }[nombre];
  scrollTo(0, 0);
}

function render() {
  // Negocio
  const q = $('buscar').value.trim().toLowerCase();
  const clientes = D.clientes.map(c => ({ c, debe: saldoCliente(c) })).sort((a, b) => b.debe - a.debe);
  $('totalMeDeben').textContent = fmt(suma(clientes, x => Math.max(x.debe, 0)));
  $('listaClientes').innerHTML = clientes
    .filter(x => x.c.nombre.toLowerCase().includes(q))
    .map(({ c, debe }) => {
      const ult = c.movs[c.movs.length - 1];
      return `<li class="toca" onclick="verCliente('${c.id}')"><div><b>${esc(c.nombre)}</b>
        <small>${ult ? 'Último movimiento: ' + bonita(ult.fecha) : 'Sin movimientos'}</small></div>
        <span class="monto ${debe > 0 ? 'mas' : 'aldia'}">${debe > 0 ? fmt(debe) : 'Al día ✓'}</span></li>`;
    }).join('');

  // Personal
  $('saldoBanco').textContent = fmt(D.banco);
  $('saldoEfectivo').textContent = fmt(D.efectivo);
  const debo = suma(D.deudas, saldoDeuda);
  $('totalDebo').textContent = fmt(debo);
  $('listaDeudas').innerHTML = D.deudas.map(d => {
    const s = saldoDeuda(d);
    return `<li class="toca" onclick="abonarDeuda('${d.id}')"><div><b>${esc(d.acreedor)}</b>
      <small>Desde ${bonita(d.fecha)} · era ${fmt(d.monto)}</small></div>
      <span class="monto ${s > 0 ? 'mas' : 'aldia'}">${s > 0 ? fmt(s) : 'Pagada ✓'}</span>
      <button type="button" class="x" aria-label="Borrar" onclick="event.stopPropagation(); borrar('deudas','${d.id}')">×</button></li>`;
  }).join('');

  const p = proyeccion(D);
  const mes = fechaISO().slice(0, 7);
  $('listaMovs').innerHTML = D.movs.filter(m => m.fecha.startsWith(mes)).reverse().map(m =>
    `<li><div><b>${esc(m.cat)}</b><small>${bonita(m.fecha)} · ${m.cuenta === 'banco' ? 'Banco' : 'Efectivo'}${m.nota ? ' · ' + esc(m.nota) : ''}</small></div>
     <span class="monto ${m.tipo === 'gasto' ? 'mas' : 'menos'}">${m.tipo === 'gasto' ? '−' : '+'}${fmt(m.monto)}</span>
     <button type="button" class="x" aria-label="Borrar" onclick="borrarMov('${m.id}')">×</button></li>`).join('');

  const cats = Object.entries(p.porCat).sort((a, b) => b[1] - a[1]);
  let estado;
  if (p.final < 0) estado = ['ojo', '⚠️ A este ritmo no te alcanza para terminar el mes. Intenta gastar menos.'];
  else if (p.gastos > p.ingresos) estado = ['ojo', '👀 Este mes has gastado más de lo que te ha entrado.'];
  else estado = ['bien', '👍 Vas bien este mes.'];
  $('proyeccion').innerHTML = `
    <span>Proyección a fin de mes</span>
    <strong>${fmt(p.final)}</strong>
    <p>Hoy tienes <b>${fmt(p.actual)}</b>. Este mes te entró <b class="menos">${fmt(p.ingresos)}</b> y gastaste <b class="mas">${fmt(p.gastos)}</b>.
    Gastas unos <b>${fmt(p.gastoDiario)}</b> por día y faltan <b>${p.restantes}</b> días.</p>
    ${debo > 0 ? `<p>Si además pagaras todas tus deudas te quedarían <b>${fmt(p.final - debo)}</b>.</p>` : ''}
    <p class="estado ${estado[0]}">${estado[1]}</p>
    ${cats.length ? '<span>¿En qué se va la plata?</span>' : ''}
    ${cats.map(([c, v]) => `<small>${esc(c)}: ${fmt(v)}</small><div class="barra"><i style="width:${(v / p.gastos) * 100}%"></i></div>`).join('')}`;
}

// ---------- Formulario genérico ----------
// campos: [{ name, label, value, tipo: 'texto'|'monto'|'fecha', opciones: [[valor, texto]], opcional }]
function form(titulo, campos, alGuardar) {
  const f = $('dlgForm');
  f.innerHTML = `<h3>${esc(titulo)}</h3>` + campos.map(c => `<label>${esc(c.label)}${
    c.opciones
      ? `<select name="${c.name}">${c.opciones.map(([v, t]) => `<option value="${esc(v)}">${esc(t)}</option>`).join('')}</select>`
      : `<input name="${c.name}" value="${esc(c.value)}" ${c.opcional ? '' : 'required'}
           type="${c.tipo === 'fecha' ? 'date' : 'text'}" ${c.tipo === 'monto' ? 'inputmode="decimal" placeholder="0"' : ''}>`
  }</label>`).join('') +
    `<div class="fila"><button type="button" class="btn sec" onclick="$('dlg').close()">Cancelar</button><button class="btn">Guardar</button></div>`;
  f.onsubmit = e => {
    e.preventDefault();
    const v = Object.fromEntries(new FormData(f));
    for (const c of campos) {
      if (c.tipo !== 'monto') continue;
      v[c.name] = num(v[c.name]);
      if (Number.isNaN(v[c.name]) || (!c.cero && v[c.name] === 0)) return alert(`Escribe un valor válido en "${c.label}".`);
    }
    if (alGuardar(v) === false) return;
    $('dlg').close();
    guardar();
  };
  if (!$('dlg').open) $('dlg').showModal();
  f.querySelector('input')?.focus();
}

// ---------- Negocio ----------
function nuevoCliente() {
  form('Nuevo cliente', [
    { name: 'nombre', label: 'Nombre' },
    { name: 'monto', label: 'Cuánto debe ahora (deja 0 si nada)', tipo: 'monto', value: '0', cero: true },
    { name: 'nota', label: 'Qué se llevó (opcional)', opcional: true },
  ], v => {
    const c = { id: uid(), nombre: v.nombre.trim(), movs: [] };
    if (v.monto > 0) c.movs.push({ id: uid(), fecha: fechaISO(), tipo: 'deuda', monto: v.monto, nota: v.nota });
    D.clientes.push(c);
  });
}

function verCliente(id) {
  const c = D.clientes.find(x => x.id === id);
  const debe = saldoCliente(c);
  const f = $('dlgForm');
  f.onsubmit = null;
  f.innerHTML = `<h3>${esc(c.nombre)}</h3>
    <div class="card destacada"><span>${debe > 0 ? 'Te debe' : 'Está al día'}</span><strong>${fmt(Math.max(debe, 0))}</strong></div>
    <div class="fila">
      <button type="button" class="btn rojo" onclick="movCliente('${id}','deuda')">+ Fiar</button>
      <button type="button" class="btn verde" onclick="movCliente('${id}','abono')">Abono / pago</button>
    </div>
    <ul class="lista">${[...c.movs].reverse().map(m => `<li><div><b>${m.tipo === 'deuda' ? 'Fiado' : 'Abonó'}</b>
      <small>${bonita(m.fecha)}${m.nota ? ' · ' + esc(m.nota) : ''}</small></div>
      <span class="monto ${m.tipo === 'deuda' ? 'mas' : 'menos'}">${m.tipo === 'deuda' ? '+' : '−'}${fmt(m.monto)}</span>
      <button type="button" class="x" aria-label="Borrar" onclick="borrarMovCliente('${id}','${m.id}')">×</button></li>`).join('')}</ul>
    <div class="fila">
      <button type="button" class="btn sec" onclick="borrarCliente('${id}')">Borrar cliente</button>
      <button type="button" class="btn" onclick="$('dlg').close()">Cerrar</button>
    </div>`;
  if (!$('dlg').open) $('dlg').showModal();
}

function movCliente(id, tipo) {
  const c = D.clientes.find(x => x.id === id);
  form(tipo === 'deuda' ? `Fiar a ${c.nombre}` : `Abono de ${c.nombre} (debe ${fmt(saldoCliente(c))})`, [
    { name: 'monto', label: 'Valor', tipo: 'monto' },
    { name: 'fecha', label: 'Fecha', tipo: 'fecha', value: fechaISO() },
    { name: 'nota', label: tipo === 'deuda' ? 'Qué se llevó (opcional)' : 'Nota (opcional)', opcional: true },
  ], v => {
    c.movs.push({ id: uid(), fecha: v.fecha, tipo, monto: v.monto, nota: v.nota });
    c.movs.sort((a, b) => a.fecha.localeCompare(b.fecha));
    setTimeout(() => verCliente(id)); // volver a la ficha del cliente
  });
}

function borrarMovCliente(id, movId) {
  if (!confirm('¿Borrar este movimiento?')) return;
  const c = D.clientes.find(x => x.id === id);
  c.movs = c.movs.filter(m => m.id !== movId);
  guardar();
  verCliente(id);
}

function borrarCliente(id) {
  if (!confirm('¿Borrar este cliente y todo su historial?')) return;
  D.clientes = D.clientes.filter(c => c.id !== id);
  $('dlg').close();
  guardar();
}

// ---------- Personal ----------
function editarSaldo(cuenta) {
  form(`Saldo actual en ${cuenta === 'banco' ? 'el banco' : 'efectivo'}`, [
    { name: 'monto', label: 'Cuánto tienes ahora mismo', tipo: 'monto', value: String(D[cuenta]), cero: true },
  ], v => { D[cuenta] = v.monto; });
}

function nuevoMov(tipo) {
  form(tipo === 'gasto' ? 'Nuevo gasto' : 'Nuevo ingreso', [
    { name: 'monto', label: 'Valor', tipo: 'monto' },
    { name: 'cat', label: 'Categoría', opciones: CATS[tipo].map(c => [c, c]) },
    { name: 'cuenta', label: tipo === 'gasto' ? '¿Con qué pagaste?' : '¿A dónde entró?', opciones: CUENTAS },
    { name: 'fecha', label: 'Fecha', tipo: 'fecha', value: fechaISO() },
    { name: 'nota', label: 'Nota (opcional)', opcional: true },
  ], v => {
    D.movs.push({ id: uid(), tipo, ...v });
    D.movs.sort((a, b) => a.fecha.localeCompare(b.fecha));
    D[v.cuenta] += tipo === 'ingreso' ? v.monto : -v.monto;
  });
}

function borrarMov(id) {
  const m = D.movs.find(x => x.id === id);
  if (!confirm('¿Borrar este movimiento? El saldo se corregirá.')) return;
  D[m.cuenta] -= m.tipo === 'ingreso' ? m.monto : -m.monto;
  D.movs = D.movs.filter(x => x.id !== id);
  guardar();
}

function nuevaDeuda() {
  form('Agregar algo que yo debo', [
    { name: 'acreedor', label: '¿A quién le debes? (persona, banco, tienda…)' },
    { name: 'monto', label: '¿Cuánto debes?', tipo: 'monto' },
    { name: 'fecha', label: 'Fecha', tipo: 'fecha', value: fechaISO() },
  ], v => { D.deudas.push({ id: uid(), acreedor: v.acreedor.trim(), monto: v.monto, fecha: v.fecha, abonos: [] }); });
}

function abonarDeuda(id) {
  const d = D.deudas.find(x => x.id === id);
  const s = saldoDeuda(d);
  if (s <= 0) return alert('Esta deuda ya está pagada. Puedes borrarla con la ×.');
  form(`Pagar a ${d.acreedor} (debes ${fmt(s)})`, [
    { name: 'monto', label: 'Cuánto pagaste', tipo: 'monto', value: String(s) },
    { name: 'cuenta', label: '¿De dónde salió la plata?', opciones: [...CUENTAS, ['', 'No descontar de mis saldos']] },
  ], v => {
    if (v.monto > s + 0.001) return alert(`Eso es más de lo que debes (${fmt(s)}).`), false;
    d.abonos.push({ fecha: fechaISO(), monto: v.monto });
    if (v.cuenta) D[v.cuenta] -= v.monto;
  });
}

function borrar(lista, id) {
  if (!confirm('¿Borrar?')) return;
  D[lista] = D[lista].filter(x => x.id !== id);
  guardar();
}

// ---------- Copia de seguridad ----------
async function exportar() {
  const nombre = `finanzas-${fechaISO()}.json`;
  const archivo = new File([JSON.stringify(D, null, 1)], nombre, { type: 'application/json' });
  // En iPhone abre "Compartir" para guardarlo en Archivos/iCloud; si no se puede, descarga normal
  if (navigator.canShare?.({ files: [archivo] })) {
    try { await navigator.share({ files: [archivo] }); return; } catch (e) { if (e.name === 'AbortError') return; }
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(archivo);
  a.download = nombre;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

async function importar(input) {
  const archivo = input.files[0];
  input.value = '';
  if (!archivo) return;
  try {
    const datos = JSON.parse(await archivo.text());
    const ok = ['clientes', 'deudas', 'movs'].every(k => Array.isArray(datos[k])) &&
      ['banco', 'efectivo'].every(k => typeof datos[k] === 'number');
    if (!ok) throw new Error();
    if (!confirm('Esto reemplazará TODOS tus datos actuales por los del archivo. ¿Continuar?')) return;
    D = Object.assign(vacio(), datos);
    guardar();
    alert('¡Copia importada!');
  } catch {
    alert('Ese archivo no es una copia de seguridad válida de esta app.');
  }
}

// ---------- Arranque (al final, cuando todo ya está definido) ----------
if (typeof document !== 'undefined') {
  D = cargar();
  navigator.serviceWorker?.register('sw.js');
  navigator.storage?.persist?.();
  render();
}
