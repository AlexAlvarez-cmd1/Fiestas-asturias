/**
 * Migra el campo isAdmin de string ('true'/'false') a boolean (true/false)
 * en todos los documentos de la colección 'users'.
 *
 * USO:
 *   node scripts/migrar-isadmin.js          → preview (no modifica nada)
 *   node scripts/migrar-isadmin.js --apply  → aplica los cambios
 */

const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const path = require('path');

initializeApp({ credential: cert(require(path.join(__dirname, 'serviceAccountKey.json'))) });
const db = getFirestore();

const APPLY = process.argv.includes('--apply');

async function main() {
  console.log('📥 Cargando usuarios...');
  const snap = await db.collection('users').get();
  console.log(`   Total usuarios: ${snap.docs.length}`);

  const aMigrar = snap.docs.filter(d => {
    const v = d.data().isAdmin;
    return typeof v === 'string';
  });

  if (aMigrar.length === 0) {
    console.log('✅ Todos los isAdmin ya son boolean. Nada que migrar.');
    return;
  }

  console.log(`\n⚠️  Usuarios con isAdmin como string: ${aMigrar.length}`);
  for (const d of aMigrar) {
    const actual = d.data().isAdmin;
    const nuevo = actual === 'true';
    console.log(`   ${d.id.slice(0, 8)}… isAdmin: "${actual}" → ${nuevo}`);
  }

  if (!APPLY) {
    console.log('\n⚡ Modo preview — no se modificó nada.');
    console.log('   Para aplicar:\n   node scripts/migrar-isadmin.js --apply');
    return;
  }

  console.log('\n✏️  Aplicando migración...');
  const batch = db.batch();
  for (const d of aMigrar) {
    const nuevo = d.data().isAdmin === 'true';
    batch.update(d.ref, { isAdmin: nuevo });
  }
  await batch.commit();
  console.log(`✅ Migrados ${aMigrar.length} usuarios.`);
}

main().catch(err => {
  console.error('❌ Error:', err.message);
  process.exit(1);
});
