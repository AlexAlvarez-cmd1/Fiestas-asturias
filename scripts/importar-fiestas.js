const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

const serviceAccount = require('./serviceAccountKey.json');
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

const DEFAULT_IMAGE = 'https://images.unsplash.com/photo-1533174000228-403285040149?q=80&w=600';
const CSV_PATH = path.join(__dirname, 'fiestas-plantilla.csv');

function parseCsv(filePath) {
  const content = fs.readFileSync(filePath, 'latin1');
  const lines = content.split(/\r?\n/).filter(l => l.trim());
  const headers = lines[0].split(';').map(h => h.trim());
  return lines.slice(1).map(line => {
    const values = line.split(';').map(v => v.trim());
    const row = {};
    headers.forEach((h, i) => { row[h] = values[i] || ''; });
    return row;
  });
}

function buildGeoPoint(lat, lon) {
  const la = parseFloat(lat);
  const lo = parseFloat(lon);
  if (isNaN(la) || isNaN(lo)) throw new Error(`Coordenadas inválidas: "${lat}", "${lon}"`);
  return new admin.firestore.GeoPoint(la, lo);
}

function buildBase(row) {
  return {
    nombre: row.nombre,
    concejo: row.concejo,
    fecha: row.fecha,
    imagen: row.imagen || DEFAULT_IMAGE,
    linkEntradas: row.linkEntradas || '',
    esVersity: row.esVersity === 'true' ? 'true' : 'false',
    linkVersity: row.linkVersity || '',
    ubicacion: buildGeoPoint(row.latitud, row.longitud),
    asistentes: 0,
    vistas: 0,
    valoracionTotal: 0,
    numValoraciones: 0,
  };
}

async function borrarDocs(ids) {
  for (const id of ids) {
    await db.collection('fiestas').doc(id).delete();
    console.log(`🗑️  Borrado ${id}`);
  }
}

async function importar() {
  // Borrar los documentos mal importados anteriormente
  const malImportados = [
    '73aqa70SAWo4q6xU5q0W', 'JxOOmnWvBngIfyUhzr66', 'XMr23ZLY6a294p8Jj2bg',
    'Jk0NLBYvbjt3yMrzYRef', '4ur2ivunpWhhraTjQDn8', 'XqbJQ0uaKsJo3aIEI3GA',
    '3iCkE7JGdXQvCgGmAQNb', '8918pGRW4yKGxx0Pfs6U', '3qkhrjtCj2VGAftrAtBk',
    '033V13a6kRaNT4mc5MI9',
  ];
  console.log('Borrando importación anterior...');
  await borrarDocs(malImportados);

  const rows = parseCsv(CSV_PATH);

  // Una fila sin grupoId pero sin nombre es continuación del grupo anterior
  const grupos = {};
  const singles = [];
  let lastGrupoId = null;

  rows.forEach(row => {
    if (row.grupoId) {
      lastGrupoId = row.grupoId;
      if (!grupos[lastGrupoId]) grupos[lastGrupoId] = [];
      grupos[lastGrupoId].push(row);
    } else if (!row.nombre) {
      // Fila de continuación — pertenece al grupo anterior
      if (lastGrupoId) grupos[lastGrupoId].push(row);
    } else {
      // Fiesta de un solo día
      lastGrupoId = null;
      singles.push(row);
    }
  });

  const fiestas = [];

  singles.forEach(row => {
    fiestas.push({
      ...buildBase(row),
      orquesta: row.orquesta || '',
      dj: row.dj || '',
    });
  });

  Object.values(grupos).forEach(grupo => {
    const base = grupo[0];
    const dias = grupo.map(row => ({
      fecha: row.fecha,
      orquesta: row.orquesta || '',
      dj: row.dj || '',
    }));
    fiestas.push({
      ...buildBase(base),
      fechaFin: grupo[grupo.length - 1].fecha,
      dias,
    });
  });

  console.log(`\nImportando ${fiestas.length} fiesta(s)...\n`);

  for (const fiesta of fiestas) {
    try {
      const ref = await db.collection('fiestas').add(fiesta);
      const label = fiesta.dias
        ? `${fiesta.nombre} (${fiesta.dias.length} días)`
        : fiesta.nombre;
      console.log(`✅ ${label} → ${ref.id}`);
    } catch (e) {
      console.error(`❌ Error en "${fiesta.nombre}":`, e.message);
    }
  }

  console.log('\n¡Importación completada!');
  process.exit(0);
}

importar().catch(e => { console.error(e); process.exit(1); });
