import { Stack, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator, FlatList, ScrollView, StyleSheet,
  Text, TouchableOpacity, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useConfig } from '../contexts/ConfigContext';
import { cacheService } from '../services/cacheService';
import { logrosService } from '../services/logrosService';

export default function PantallaOrquestas() {
  const router = useRouter();
  const { primaryColor, textColor, theme } = useConfig();
  const isDark = theme === 'dark';

  const [orquestas, setOrquestas] = useState([]);
  const [djs, setDjs] = useState([]);
  const [fiestas, setFiestas] = useState([]);
  const [seguidas, setSeguidas] = useState([]);
  const [expandida, setExpandida] = useState(null);
  const [tab, setTab] = useState('orquestas'); // 'orquestas' | 'djs'
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    const init = async () => {
      const data = await cacheService.getCachedFiestas() || [];
      setFiestas(data);

      // Build orchestra list (top-level + multiday dias)
      const mapa = {};
      data.forEach(f => {
        const entradas = f.dias?.length
          ? f.dias.filter(d => d.orquesta).map(d => ({ ...f, orquesta: d.orquesta, _diaFecha: d.fecha }))
          : (f.orquesta ? [f] : []);
        entradas.forEach(entry => {
          if (!mapa[entry.orquesta]) mapa[entry.orquesta] = [];
          mapa[entry.orquesta].push(f);
        });
      });

      const lista = Object.entries(mapa)
        .map(([nombre, items]) => ({ nombre, fiestas: items.sort((a, b) => new Date(a.fecha) - new Date(b.fecha)) }))
        .sort((a, b) => b.fiestas.length - a.fiestas.length);

      setOrquestas(lista);

      // Build DJ list (top-level + multiday dias)
      const mapaDjs = {};
      data.forEach(f => {
        const entradas = f.dias?.length
          ? f.dias.filter(d => d.dj).map(d => ({ ...f, dj: d.dj }))
          : (f.dj ? [f] : []);
        entradas.forEach(entry => {
          if (!mapaDjs[entry.dj]) mapaDjs[entry.dj] = [];
          mapaDjs[entry.dj].push(f);
        });
      });
      const listaDjs = Object.entries(mapaDjs)
        .map(([nombre, items]) => ({ nombre, fiestas: items.sort((a, b) => new Date(a.fecha) - new Date(b.fecha)) }))
        .sort((a, b) => b.fiestas.length - a.fiestas.length);
      setDjs(listaDjs);

      setSeguidas(await logrosService.getOrquestasList());
      setCargando(false);
    };
    init();
  }, []);

  const toggleSeguir = async (nombre) => {
    const newList = await logrosService.toggleOrquesta(nombre);
    setSeguidas(newList);
  };

  const irDetalle = (fiesta) => router.push({
    pathname: '/detalle',
    params: {
      id: fiesta.id, nombre: fiesta.nombre, concejo: fiesta.concejo,
      fecha: fiesta.fecha, orquesta: fiesta.orquesta, imagen: fiesta.imagen,
      latitud: fiesta.ubicacion?.latitude, longitud: fiesta.ubicacion?.longitude,
      esVersity: fiesta.esVersity, linkVersity: fiesta.linkVersity,
      dj: fiesta.dj || '',
      fechaFin: fiesta.fechaFin || '',
      diasJson: fiesta.dias ? JSON.stringify(fiesta.dias) : '',
      linkEntradas: fiesta.linkEntradas || '',
    },
  });

  const renderOrquesta = ({ item }) => {
    const esSeguida = seguidas.includes(item.nombre);
    const isOpen = expandida === item.nombre;

    return (
      <View style={[styles.card, isDark && styles.cardDark]}>
        <TouchableOpacity
          style={styles.cardHeader}
          onPress={() => setExpandida(isOpen ? null : item.nombre)}
          activeOpacity={0.8}
        >
          <View style={styles.cardLeft}>
            <Text style={styles.cardEmoji}>🎵</Text>
            <View>
              <Text style={[styles.cardNombre, isDark && styles.textDark]} numberOfLines={1}>
                {item.nombre}
              </Text>
              <Text style={[styles.cardSub, isDark && styles.subDark]}>
                {item.fiestas.length} {item.fiestas.length === 1 ? 'fiesta' : 'fiestas'}
              </Text>
            </View>
          </View>
          <View style={styles.cardRight}>
            <TouchableOpacity
              style={[styles.btnSeguir, esSeguida && { backgroundColor: primaryColor }]}
              onPress={() => toggleSeguir(item.nombre)}
            >
              <Text style={[styles.btnSeguirTxt, esSeguida && { color: textColor }]}>
                {esSeguida ? '✓ Siguiendo' : '+ Seguir'}
              </Text>
            </TouchableOpacity>
            <Text style={[styles.chevron, isDark && styles.subDark]}>{isOpen ? '▲' : '▼'}</Text>
          </View>
        </TouchableOpacity>

        {isOpen && (
          <View style={styles.fiestasList}>
            {item.fiestas.map(fiesta => {
              const fecha = new Date(fiesta.fecha).toLocaleDateString('es-ES', {
                day: 'numeric', month: 'short', year: 'numeric',
              });
              return (
                <TouchableOpacity
                  key={fiesta.id}
                  style={[styles.fiestaRow, isDark && styles.fiestaRowDark]}
                  onPress={() => irDetalle(fiesta)}
                  activeOpacity={0.7}
                >
                  <View style={[styles.fechaBadge, { backgroundColor: primaryColor }]}>
                    <Text style={[styles.fechaTxt, { color: textColor }]}>{fecha}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.fiestaName, isDark && styles.textDark]} numberOfLines={1}>
                      {fiesta.nombre}
                    </Text>
                    <Text style={[styles.fiestaLoc, isDark && styles.subDark]}>📍 {fiesta.concejo}</Text>
                    {fiesta.numValoraciones > 0 && (
                      <Text style={styles.fiestaRating}>
                        ⭐ {(fiesta.valoracionTotal / fiesta.numValoraciones).toFixed(1)}
                      </Text>
                    )}
                  </View>
                  <Text style={[styles.arrow, isDark && styles.subDark]}>›</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        )}
      </View>
    );
  };

  return (
    <SafeAreaView style={[styles.container, isDark && styles.containerDark]} edges={['top']}>
      <Stack.Screen
        options={{
          title: 'Orquestas',
          headerStyle: { backgroundColor: isDark ? '#1e1e1e' : undefined },
          headerTintColor: isDark ? '#f1f1f1' : undefined,
        }}
      />

      <View style={[styles.headerBand, { backgroundColor: primaryColor }]}>
        <Text style={[styles.titulo, { color: textColor }]}>
          {tab === 'orquestas' ? '🎵 Orquestas' : '🎧 DJs'}
        </Text>
        <Text style={[styles.subtitulo, { color: textColor, opacity: 0.8 }]}>
          {tab === 'orquestas'
            ? (seguidas.length > 0 ? `Siguiendo ${seguidas.length} orquesta${seguidas.length > 1 ? 's' : ''}` : 'Sigue tus orquestas favoritas')
            : `${djs.length} DJ${djs.length !== 1 ? 's' : ''} encontrado${djs.length !== 1 ? 's' : ''}`}
        </Text>
        <View style={styles.tabRow}>
          <TouchableOpacity
            style={[styles.tabBtn, tab === 'orquestas' && styles.tabBtnActivo]}
            onPress={() => { setTab('orquestas'); setExpandida(null); }}
          >
            <Text style={[styles.tabBtnTxt, tab === 'orquestas' && { color: primaryColor }]}>🎵 Orquestas</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tabBtn, tab === 'djs' && styles.tabBtnActivo]}
            onPress={() => { setTab('djs'); setExpandida(null); }}
          >
            <Text style={[styles.tabBtnTxt, tab === 'djs' && { color: primaryColor }]}>🎧 DJs</Text>
          </TouchableOpacity>
        </View>
      </View>

      {seguidas.length > 0 && (
        <View style={[styles.seguidasRow]}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ padding: 12, gap: 8 }}>
            {seguidas.map(nombre => (
              <TouchableOpacity
                key={nombre}
                style={[styles.seguidaChip, { backgroundColor: primaryColor }]}
                onPress={() => {
                  setExpandida(nombre);
                }}
              >
                <Text style={[styles.seguidaChipTxt, { color: textColor }]} numberOfLines={1}>
                  🎵 {nombre}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}

      {cargando ? (
        <View style={styles.loader}>
          <ActivityIndicator size="large" color={primaryColor} />
        </View>
      ) : (tab === 'orquestas' ? orquestas : djs).length === 0 ? (
        <View style={styles.vacio}>
          <Text style={styles.vacioEmoji}>{tab === 'orquestas' ? '🎶' : '🎧'}</Text>
          <Text style={[styles.vacioTxt, isDark && styles.textDark]}>
            {tab === 'orquestas' ? 'Aún no hay orquestas registradas' : 'Aún no hay DJs registrados'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={tab === 'orquestas' ? orquestas : djs}
          keyExtractor={item => item.nombre}
          renderItem={renderOrquesta}
          contentContainerStyle={styles.lista}
          showsVerticalScrollIndicator={false}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f4f4f4' },
  containerDark: { backgroundColor: '#121212' },

  headerBand: {
    paddingHorizontal: 20, paddingTop: 16, paddingBottom: 20,
    borderBottomLeftRadius: 24, borderBottomRightRadius: 24,
  },
  titulo: { fontSize: 24, fontWeight: 'bold' },
  subtitulo: { fontSize: 13, marginTop: 3 },
  tabRow: {
    flexDirection: 'row', gap: 8, marginTop: 14,
  },
  tabBtn: {
    flex: 1, paddingVertical: 8, borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center',
  },
  tabBtnActivo: { backgroundColor: 'rgba(255,255,255,0.95)' },
  tabBtnTxt: { fontSize: 14, fontWeight: '600', color: 'rgba(255,255,255,0.9)' },

  seguidasRow: { borderBottomWidth: 1, borderBottomColor: 'rgba(0,0,0,0.06)' },
  seguidaChip: {
    paddingHorizontal: 14, paddingVertical: 7,
    borderRadius: 20, maxWidth: 160,
  },
  seguidaChipTxt: { fontSize: 13, fontWeight: '600' },

  lista: { padding: 14, gap: 10 },
  card: {
    backgroundColor: 'white', borderRadius: 16,
    elevation: 2, shadowColor: '#000', shadowOpacity: 0.07,
    shadowRadius: 4, shadowOffset: { width: 0, height: 1 },
    overflow: 'hidden',
  },
  cardDark: { backgroundColor: '#1e1e1e' },
  cardHeader: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', padding: 14,
  },
  cardLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  cardEmoji: { fontSize: 28 },
  cardNombre: { fontSize: 15, fontWeight: 'bold', color: '#1e293b', maxWidth: 160 },
  cardSub: { fontSize: 12, color: '#94a3b8', marginTop: 2 },
  cardRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  btnSeguir: {
    borderWidth: 1.5, borderColor: '#94a3b8',
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20,
  },
  btnSeguirTxt: { fontSize: 12, fontWeight: '600', color: '#64748b' },
  chevron: { fontSize: 11, color: '#94a3b8' },

  fiestasList: { paddingHorizontal: 14, paddingBottom: 10 },
  fiestaRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: '#f8fafc', borderRadius: 12, padding: 10, marginBottom: 6,
  },
  fiestaRowDark: { backgroundColor: '#2a2a2a' },
  fechaBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  fechaTxt: { fontSize: 11, fontWeight: 'bold' },
  fiestaName: { fontSize: 14, fontWeight: '600', color: '#1e293b' },
  fiestaLoc: { fontSize: 12, color: '#64748b', marginTop: 1 },
  fiestaRating: { fontSize: 11, color: '#f59e0b', fontWeight: '700', marginTop: 2 },
  arrow: { fontSize: 20, color: '#cbd5e1' },

  textDark: { color: '#f1f1f1' },
  subDark: { color: '#888' },
  loader: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  vacio: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 30 },
  vacioEmoji: { fontSize: 52, marginBottom: 12 },
  vacioTxt: { fontSize: 16, color: '#64748b', textAlign: 'center' },
});
