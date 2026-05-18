/**
 * Detecta y elimina fiestas duplicadas en Firestore.
 * Criterio de duplicado: mismo nombre + fecha + concejo (ignorando mayúsculas/espacios).
 * Mantiene el documento con más campos rellenados; borra el resto.
 *
 * USO:
 *   node scripts/limpiar-duplicados.js          → modo preview (no borra nada)
 *   node scripts/limpiar-duplicados.js --borrar → borra los duplicados
 */

const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const path = require('path');

const CLAVE_SERVICIO = path.join(__dirname, 'serviceAccountKey.json');
const MODO_BORRAR = process.argv.includes('--borrar');

initializeApp({ credential: cert(require(CLAVE_SERVICIO)) });
const db = getFirestore();

const normalizar = (str) =>
  (str || '').toLowerCase().trim().replace(/\s+/g, ' ');

const pesoDoc = (data) =>
  Object.values(data).filter(v => v !== null && v !== undefined && v !== '').length;

async function main() {
  console.log('📥 Cargando fiestas de Firestore...');
  const snap = await db.collection('fiestas').get();
  const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  console.log(`   Total documentos: ${docs.length}`);

  // Agrupar por clave de duplicado
  const grupos = {};
  for (const doc of docs) {
    const clave = [
      normalizar(doc.nombre),
      normalizar(doc.fecha),
      normalizar(doc.concejo),
    ].join('|');
    if (!grupos[clave]) grupos[clave] = [];
    grupos[clave].push(doc);
  }

  const duplicados = Object.values(grupos).filter(g => g.length > 1);

  if (duplicados.length === 0) {
    console.log('✅ No hay duplicados. La colección está limpia.');
    return;
  }

  console.log(`\n⚠️  Grupos con duplicados: ${duplicados.length}`);

  let totalABorrar = 0;
  const idsBorrar = [];

  for (const grupo of duplicados) {
    // Ordenar: el que tiene más campos rellenos se queda
    grupo.sort((a, b) => pesoDoc(b) - pesoDoc(a));
    const mantener = grupo[0];
    const borrar = grupo.slice(1);
    totalABorrar += borrar.length;

    console.log(`\n  📌 "${mantener.nombre}" (${mantener.concejo}, ${mantener.fecha})`);
    console.log(`     ✅ Mantener: ${mantener.id} (${pesoDoc(mantener)} campos)`);
    for (const b of borrar) {
      console.log(`     🗑️  Borrar:   ${b.id} (${pesoDoc(b)} campos)`);
      idsBorrar.push(b.id);
    }
  }

  console.log(`\n──────────────────────────────────────`);
  console.log(`  Documentos a eliminar: ${totalABorrar}`);
  console.log(`  Documentos a conservar: ${docs.length - totalABorrar}`);

  if (!MODO_BORRAR) {
    console.log(`\n⚡ Modo preview — no se borró nada.`);
    console.log(`   Para borrar, ejecuta:\n   node scripts/limpiar-duplicados.js --borrar`);
    return;
  }

  console.log('\n🗑️  Borrando duplicados...');
  // Borrar en lotes de 500 (límite de Firestore batch)
  const LOTE = 500;
  for (let i = 0; i < idsBorrar.length; i += LOTE) {
    const batch = db.batch();
    idsBorrar.slice(i, i + LOTE).forEach(id => {
      batch.delete(db.collection('fiestas').doc(id));
    });
    await batch.commit();
    console.log(`   Lote ${Math.floor(i / LOTE) + 1} eliminado`);
  }

  console.log(`\n✅ Listo. Se eliminaron ${idsBorrar.length} documentos duplicados.`);
}

main().catch(err => {
  console.error('❌ Error:', err.message);
  process.exit(1);
});
