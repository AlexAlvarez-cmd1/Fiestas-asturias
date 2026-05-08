import AsyncStorage from '@react-native-async-storage/async-storage';
import { arrayUnion, doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebaseConfig';

export const LOGROS_DEF = [
  { id: 'primerPaso',    emoji: '🎉', titulo: 'Primer Paso',     desc: 'Asiste a tu primera fiesta' },
  { id: 'folixeru',      emoji: '🎪', titulo: 'Folixeru',        desc: 'Asiste a 5 fiestas' },
  { id: 'folixaAddict',  emoji: '🏆', titulo: 'Folixa Addict',   desc: 'Asiste a 10 fiestas' },
  { id: 'coleccionista', emoji: '⭐', titulo: 'Coleccionista',   desc: 'Añade 5 fiestas a favoritos' },
  { id: 'social',        emoji: '🤝', titulo: 'Social',          desc: 'Añade tu primer amigo' },
  { id: 'fotografo',     emoji: '📸', titulo: 'Fotógrafo',       desc: 'Sube tu primera foto' },
  { id: 'viajero',       emoji: '🗺️', titulo: 'Viajero',         desc: 'Asiste a fiestas en 3 concejos distintos' },
  { id: 'orquestero',    emoji: '🎵', titulo: 'Orquestero',      desc: 'Sigue tu primera orquesta' },
];

export const logrosService = {
  // Compute which logros should be unlocked given user stats
  compute({ asistencias = [], favoritos = 0, amigos = 0, fotos = 0, concejos = 0, orquestas = 0 }) {
    const unlocked = new Set();
    if (asistencias.length >= 1)  unlocked.add('primerPaso');
    if (asistencias.length >= 5)  unlocked.add('folixeru');
    if (asistencias.length >= 10) unlocked.add('folixaAddict');
    if (favoritos >= 5)           unlocked.add('coleccionista');
    if (amigos >= 1)              unlocked.add('social');
    if (fotos >= 1)               unlocked.add('fotografo');
    if (concejos >= 3)            unlocked.add('viajero');
    if (orquestas >= 1)           unlocked.add('orquestero');
    return [...unlocked];
  },

  // Save newly unlocked logros to Firestore and return the new ones
  async syncToFirestore(uid, currentLogros, computedLogros) {
    const newOnes = computedLogros.filter(id => !currentLogros.includes(id));
    if (newOnes.length === 0) return [];
    await updateDoc(doc(db, 'users', uid), { logros: arrayUnion(...newOnes) });
    return newOnes;
  },

  // Count unique concejos from asistencias array + fiestas data
  countConcejosVisitados(asistencias, fiestas) {
    const concejos = new Set();
    asistencias.forEach(fiestaId => {
      const f = fiestas.find(f => f.id === fiestaId);
      if (f?.concejo) concejos.add(f.concejo);
    });
    return concejos.size;
  },

  // Followed orchestras count (stored in AsyncStorage)
  async getOrquestasSeguidas() {
    try {
      const raw = await AsyncStorage.getItem('orquestasSeguidas');
      return raw ? JSON.parse(raw).length : 0;
    } catch {
      return 0;
    }
  },

  async getOrquestasList() {
    try {
      const raw = await AsyncStorage.getItem('orquestasSeguidas');
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  },

  async toggleOrquesta(nombre) {
    const list = await logrosService.getOrquestasList();
    const idx = list.indexOf(nombre);
    const newList = idx >= 0 ? list.filter(n => n !== nombre) : [...list, nombre];
    await AsyncStorage.setItem('orquestasSeguidas', JSON.stringify(newList));
    return newList;
  },
};
