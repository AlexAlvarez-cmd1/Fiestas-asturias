import { collection, getDocs } from 'firebase/firestore';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator, FlatList, KeyboardAvoidingView, Modal, Platform, RefreshControl,
  ScrollView, StyleSheet, Switch, Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { db } from '../../firebaseConfig';
import { cacheService } from '../../services/cacheService';
import { favoritesService } from '../../services/favoritesService';
import { useConfig } from '../../contexts/ConfigContext';

const norm = str => (str || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

const DIAS_SEMANA = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

export default function PantallaLista() {
  const router = useRouter();
  const { primaryColor, emojiFiesta, theme, textColor } = useConfig();
  const isDark = theme === 'dark';

  const [fiestas, setFiestas] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [busqueda, setBusqueda] = useState('');
  const [viewMode, setViewMode] = useState('lista');
  const [refreshing, setRefreshing] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(() => {
    const n = new Date();
    return { year: n.getFullYear(), month: n.getMonth() };
  });
  const [selectedDay, setSelectedDay] = useState(null);
  const [filtroConcejo, setFiltroConcejo] = useState('');
  const [filtroOrquesta, setFiltroOrquesta] = useState('');
  const [soloFavoritos, setSoloFavoritos] = useState(false);
  const [favoritosIds, setFavoritosIds] = useState([]);
  const [modalFiltrosVisible, setModalFiltrosVisible] = useState(false);

  const cargar = async (isRefresh = false) => {
    if (!isRefresh) {
      const cached = await cacheService.getCachedFiestas();
      if (cached && cached.length > 0) {
        setFiestas(cached);
        setCargando(false);
      }
    }
    try {
      const querySnapshot = await getDocs(collection(db, 'fiestas'));
      const data = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setFiestas(data);
      if (data.length > 0) await cacheService.setCachedFiestas(data);
    } catch (error) {
      console.warn('Error cargando fiestas:', error);
    }
    setCargando(false);
    setRefreshing(false);
  };

  const onRefresh = () => {
    setRefreshing(true);
    cargar(true);
  };

  useFocusEffect(
    useCallback(() => {
      cargar();
      favoritesService.getFavorites().then(setFavoritosIds);
    }, [])
  );

  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);

  const concejos = useMemo(() => {
    const set = new Set(fiestas.map(f => f.concejo).filter(Boolean));
    return Array.from(set).sort();
  }, [fiestas]);

  const filtrosActivos = [filtroConcejo, filtroOrquesta.trim(), soloFavoritos].filter(Boolean).length;

  const fiestasFiltradas = fiestas
    .filter(f => {
      if (!f.fecha) return false;
      const fechaFiesta = new Date(f.fecha);
      fechaFiesta.setHours(0, 0, 0, 0);
      if (fechaFiesta < hoy) return false;
      if (soloFavoritos && !favoritosIds.includes(f.id)) return false;
      if (filtroConcejo && f.concejo !== filtroConcejo) return false;
      if (filtroOrquesta.trim() && !norm(f.orquesta).includes(norm(filtroOrquesta))) return false;
      if (busqueda.trim() !== '') {
        const q = norm(busqueda);
        return norm(f.nombre).includes(q) || norm(f.concejo).includes(q);
      }
      return true;
    })
    .sort((a, b) => new Date(a.fecha) - new Date(b.fecha));

  // ─── Calendar helpers ──────────────────────────────────────────────────────

  const getDaysWithFiestas = (year, month) => {
    const set = new Set();
    fiestas.forEach(f => {
      if (!f.fecha) return;
      const d = new Date(f.fecha);
      if (d.getFullYear() === year && d.getMonth() === month) set.add(d.getDate());
    });
    return set;
  };

  const getFiestasForDay = (day) => {
    const { year, month } = currentMonth;
    return fiestas.filter(f => {
      if (!f.fecha) return false;
      const d = new Date(f.fecha);
      return d.getFullYear() === year && d.getMonth() === month && d.getDate() === day;
    });
  };

  const irMesAnterior = () => {
    setCurrentMonth(prev => {
      const d = new Date(prev.year, prev.month - 1);
      return { year: d.getFullYear(), month: d.getMonth() };
    });
    setSelectedDay(null);
  };

  const irMesSiguiente = () => {
    setCurrentMonth(prev => {
      const d = new Date(prev.year, prev.month + 1);
      return { year: d.getFullYear(), month: d.getMonth() };
    });
    setSelectedDay(null);
  };

  // ─── Navigate to detail ────────────────────────────────────────────────────

  const irDetalle = (fiesta) => router.push({
    pathname: '/detalle',
    params: {
      id: fiesta.id, nombre: fiesta.nombre, concejo: fiesta.concejo,
      fecha: fiesta.fecha, orquesta: fiesta.orquesta, imagen: fiesta.imagen,
      latitud: fiesta.ubicacion?.latitude, longitud: fiesta.ubicacion?.longitude,
      esVersity: fiesta.esVersity, linkVersity: fiesta.linkVersity,
    },
  });

  // ─── Render: list card ─────────────────────────────────────────────────────

  const renderFiesta = ({ item: fiesta }) => {
    const fecha = new Date(fiesta.fecha).toLocaleDateString('es-ES', {
      weekday: 'short', day: 'numeric', month: 'long',
    });
    return (
      <TouchableOpacity
        style={[styles.card, isDark && styles.cardDark]}
        onPress={() => irDetalle(fiesta)}
        activeOpacity={0.7}
      >
        <View style={[styles.fechaBadge, { backgroundColor: primaryColor }]}>
          <Text style={[styles.fechaBadgeText, { color: textColor }]}>{fecha}</Text>
        </View>
        <View style={styles.cardContent}>
          <Text style={styles.emojiText}>{emojiFiesta}</Text>
          <View style={styles.textoContainer}>
            <Text style={[styles.nombre, isDark && styles.textDark]} numberOfLines={1}>
              {fiesta.nombre}
            </Text>
            <Text style={[styles.concejo, isDark && styles.subTextDark]}>📍 {fiesta.concejo}</Text>
            {fiesta.orquesta ? (
              <Text style={[styles.orquesta, isDark && styles.subTextDark]} numberOfLines={1}>
                🎵 {fiesta.orquesta}
              </Text>
            ) : null}
          </View>
          <Text style={[styles.flecha, isDark && styles.subTextDark]}>›</Text>
        </View>
      </TouchableOpacity>
    );
  };

  // ─── Render: calendar view ─────────────────────────────────────────────────

  const renderCalendario = () => {
    const { year, month } = currentMonth;
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const firstDay = new Date(year, month, 1).getDay();
    const daysWithFiestas = getDaysWithFiestas(year, month);
    const todayNow = new Date();
    const isCurrentMonth =
      todayNow.getFullYear() === year && todayNow.getMonth() === month;
    const selectedFiestas = selectedDay ? getFiestasForDay(selectedDay) : [];

    const cells = [];
    for (let i = 0; i < firstDay; i++) {
      cells.push(<View key={`e${i}`} style={styles.dayCell} />);
    }
    for (let d = 1; d <= daysInMonth; d++) {
      const hasFiesta = daysWithFiestas.has(d);
      const isSelected = selectedDay === d;
      const isToday = isCurrentMonth && todayNow.getDate() === d;
      cells.push(
        <TouchableOpacity
          key={d}
          style={[
            styles.dayCell,
            isToday && !isSelected && styles.dayCellToday,
            isSelected && { backgroundColor: primaryColor, borderRadius: 10 },
          ]}
          onPress={() => setSelectedDay(isSelected ? null : d)}
          activeOpacity={hasFiesta ? 0.7 : 0.9}
        >
          <Text style={[
            styles.dayNum,
            isDark && styles.textDark,
            isToday && !isSelected && { color: primaryColor, fontWeight: 'bold' },
            isSelected && { color: textColor, fontWeight: 'bold' },
          ]}>
            {d}
          </Text>
          {hasFiesta && (
            <View style={[
              styles.dot,
              { backgroundColor: isSelected ? textColor : primaryColor },
            ]} />
          )}
        </TouchableOpacity>
      );
    }

    return (
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 30 }}>
        {/* Month navigation */}
        <View style={styles.monthNav}>
          <TouchableOpacity onPress={irMesAnterior} style={styles.navBtn}>
            <Text style={[styles.navArrow, { color: primaryColor }]}>‹</Text>
          </TouchableOpacity>
          <Text style={[styles.monthTitle, isDark && styles.textDark]}>
            {MESES[month]} {year}
          </Text>
          <TouchableOpacity onPress={irMesSiguiente} style={styles.navBtn}>
            <Text style={[styles.navArrow, { color: primaryColor }]}>›</Text>
          </TouchableOpacity>
        </View>

        {/* Week-day header */}
        <View style={styles.weekHeader}>
          {DIAS_SEMANA.map(d => (
            <Text key={d} style={[styles.weekDay, isDark && styles.subTextDark]}>{d}</Text>
          ))}
        </View>

        {/* Day grid */}
        <View style={styles.grid}>{cells}</View>

        {/* Fiestas of selected day */}
        {selectedDay !== null && (
          <View style={styles.selectedSection}>
            <Text style={[styles.selectedTitle, isDark && styles.textDark]}>
              {emojiFiesta} {selectedDay} de {MESES[month]}
            </Text>
            {selectedFiestas.length === 0 ? (
              <Text style={[styles.sinFiestas, isDark && styles.subTextDark]}>
                Sin fiestas este día
              </Text>
            ) : (
              selectedFiestas.map(fiesta => (
                <TouchableOpacity
                  key={fiesta.id}
                  style={[styles.card, isDark && styles.cardDark]}
                  onPress={() => irDetalle(fiesta)}
                  activeOpacity={0.7}
                >
                  <View style={styles.cardContent}>
                    <View style={styles.textoContainer}>
                      <Text style={[styles.nombre, isDark && styles.textDark]} numberOfLines={1}>
                        {fiesta.nombre}
                      </Text>
                      <Text style={[styles.concejo, isDark && styles.subTextDark]}>
                        📍 {fiesta.concejo}
                      </Text>
                      {fiesta.orquesta ? (
                        <Text style={[styles.orquesta, isDark && styles.subTextDark]} numberOfLines={1}>
                          🎵 {fiesta.orquesta}
                        </Text>
                      ) : null}
                    </View>
                    <Text style={[styles.flecha, isDark && styles.subTextDark]}>›</Text>
                  </View>
                </TouchableOpacity>
              ))
            )}
          </View>
        )}
      </ScrollView>
    );
  };

  // ─── Main render ──────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={[styles.container, isDark && styles.containerDark]} edges={['top']}>

      {/* Header */}
      <View style={[styles.header, { backgroundColor: primaryColor }]}>
        <View style={styles.headerRow}>
          <Text style={[styles.titulo, { color: textColor }]}>Próximas Fiestas</Text>
          <TouchableOpacity
            style={styles.btnOrquestas}
            onPress={() => router.push('/orquestas')}
          >
            <Text style={[styles.btnOrquestasTxt, { color: textColor }]}>🎵 Orquestas</Text>
          </TouchableOpacity>
        </View>

        {/* Toggle lista / calendario */}
        <View style={[styles.toggleRow, isDark && styles.toggleRowDark]}>
          <TouchableOpacity
            style={[styles.toggleBtn, viewMode === 'lista' && { backgroundColor: primaryColor }]}
            onPress={() => setViewMode('lista')}
          >
            <Text style={[
              styles.toggleTxt,
              viewMode === 'lista' ? { color: textColor, fontWeight: 'bold' } : { color: isDark ? '#ccc' : '#555' },
            ]}>
              📋 Lista
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.toggleBtn, viewMode === 'calendario' && { backgroundColor: primaryColor }]}
            onPress={() => setViewMode('calendario')}
          >
            <Text style={[
              styles.toggleTxt,
              viewMode === 'calendario' ? { color: textColor, fontWeight: 'bold' } : { color: isDark ? '#ccc' : '#555' },
            ]}>
              📅 Calendario
            </Text>
          </TouchableOpacity>
        </View>

        {viewMode === 'lista' && (
          <View style={styles.buscadorRow}>
            <TextInput
              style={[styles.buscador, { flex: 1 }]}
              placeholder="Buscar fiesta o concejo..."
              placeholderTextColor="#888"
              value={busqueda}
              onChangeText={setBusqueda}
            />
            <TouchableOpacity
              style={styles.btnFiltros}
              onPress={() => setModalFiltrosVisible(true)}
            >
              <Text style={styles.btnFiltrosTxt}>⚙️</Text>
              {filtrosActivos > 0 && (
                <View style={styles.filtrosBadge}>
                  <Text style={styles.filtrosBadgeTxt}>{filtrosActivos}</Text>
                </View>
              )}
            </TouchableOpacity>
          </View>
        )}
      </View>

      {cargando ? (
        <View style={styles.loader}>
          <ActivityIndicator size="large" color={primaryColor} />
        </View>
      ) : viewMode === 'lista' ? (
        fiestasFiltradas.length === 0 ? (
          <View style={styles.vacio}>
            <Text style={styles.vacioEmoji}>🎭</Text>
            <Text style={[styles.vacioText, isDark && styles.textDark]}>No hay fiestas próximas</Text>
          </View>
        ) : (
          <FlatList
            data={fiestasFiltradas}
            keyExtractor={item => item.id}
            renderItem={renderFiesta}
            contentContainerStyle={styles.lista}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={primaryColor} colors={[primaryColor]} />
            }
          />
        )
      ) : (
        <View style={styles.calendarWrapper}>
          {renderCalendario()}
        </View>
      )}
      <Modal
        visible={modalFiltrosVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setModalFiltrosVisible(false)}
      >
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <TouchableOpacity
            style={[styles.modalFondo, { flex: 1 }]}
            activeOpacity={1}
            onPress={() => setModalFiltrosVisible(false)}
          />
          <View style={[styles.modalFiltros, isDark && styles.modalFiltrosDark]}>
          <Text style={[styles.modalFiltrosTitulo, isDark && styles.textDark]}>Filtros</Text>

          <View style={styles.filtroRow}>
            <Text style={[styles.filtroLabel, isDark && styles.textDark]}>⭐ Solo favoritos</Text>
            <Switch
              value={soloFavoritos}
              onValueChange={setSoloFavoritos}
              trackColor={{ false: '#ddd', true: primaryColor }}
            />
          </View>

          <Text style={[styles.filtroLabel, isDark && styles.textDark, { marginBottom: 8 }]}>📍 Concejo</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipsRow}>
            <TouchableOpacity
              style={[styles.chip, !filtroConcejo && { backgroundColor: primaryColor }]}
              onPress={() => setFiltroConcejo('')}
            >
              <Text style={[styles.chipTxt, !filtroConcejo && { color: textColor }]}>Todos</Text>
            </TouchableOpacity>
            {concejos.map(c => (
              <TouchableOpacity
                key={c}
                style={[styles.chip, filtroConcejo === c && { backgroundColor: primaryColor }]}
                onPress={() => setFiltroConcejo(filtroConcejo === c ? '' : c)}
              >
                <Text style={[styles.chipTxt, filtroConcejo === c && { color: textColor }]}>{c}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <Text style={[styles.filtroLabel, isDark && styles.textDark, { marginTop: 16, marginBottom: 8 }]}>🎵 Orquesta</Text>
          <TextInput
            style={[styles.filtroInput, isDark && styles.filtroInputDark]}
            placeholder="Nombre de orquesta..."
            placeholderTextColor="#888"
            value={filtroOrquesta}
            onChangeText={setFiltroOrquesta}
          />

          <View style={styles.filtrosBtns}>
            <TouchableOpacity
              style={[styles.btnLimpiar, isDark && styles.btnLimpiarDark]}
              onPress={() => { setFiltroConcejo(''); setFiltroOrquesta(''); setSoloFavoritos(false); }}
            >
              <Text style={[styles.btnLimpiarTxt, isDark && styles.subTextDark]}>Limpiar</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.btnAplicar, { backgroundColor: primaryColor }]}
              onPress={() => setModalFiltrosVisible(false)}
            >
              <Text style={[styles.btnAplicarTxt, { color: textColor }]}>Aplicar</Text>
            </TouchableOpacity>
          </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f4f4f4' },
  containerDark: { backgroundColor: '#121212' },

  header: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 20,
    borderBottomLeftRadius: 25,
    borderBottomRightRadius: 25,
  },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  titulo: { fontSize: 26, fontWeight: 'bold' },
  btnOrquestas: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16,
  },
  btnOrquestasTxt: { fontSize: 13, fontWeight: '600' },

  toggleRow: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.25)',
    borderRadius: 14,
    padding: 4,
    marginBottom: 12,
  },
  toggleRowDark: { backgroundColor: 'rgba(0,0,0,0.25)' },
  toggleBtn: {
    flex: 1, paddingVertical: 8, borderRadius: 11,
    alignItems: 'center',
  },
  toggleTxt: { fontSize: 14 },

  buscadorRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  buscador: {
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderRadius: 12,
    paddingHorizontal: 15,
    paddingVertical: 10,
    fontSize: 16,
    color: '#333',
  },
  btnFiltros: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    width: 46, height: 46, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
  },
  btnFiltrosTxt: { fontSize: 20 },
  filtrosBadge: {
    position: 'absolute', top: 4, right: 4,
    backgroundColor: '#ef4444',
    width: 16, height: 16, borderRadius: 8,
    alignItems: 'center', justifyContent: 'center',
  },
  filtrosBadgeTxt: { color: 'white', fontSize: 10, fontWeight: 'bold' },

  modalFondo: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' },
  modalFiltros: {
    backgroundColor: 'white',
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 24, paddingBottom: 44,
  },
  modalFiltrosDark: { backgroundColor: '#1e1e1e' },
  modalFiltrosTitulo: { fontSize: 20, fontWeight: 'bold', color: '#1e293b', marginBottom: 20 },
  filtroRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 20,
  },
  filtroLabel: { fontSize: 15, fontWeight: '600', color: '#334155' },
  chipsRow: { marginBottom: 4 },
  chip: {
    backgroundColor: '#f1f5f9', paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: 20, marginRight: 8,
  },
  chipTxt: { fontSize: 13, color: '#475569', fontWeight: '600' },
  filtroInput: {
    backgroundColor: '#f1f5f9', borderRadius: 12,
    paddingHorizontal: 15, paddingVertical: 10, fontSize: 15, color: '#333',
  },
  filtroInputDark: { backgroundColor: '#2a2a2a', color: '#f1f1f1' },
  filtrosBtns: { flexDirection: 'row', gap: 12, marginTop: 24 },
  btnLimpiar: {
    flex: 1, padding: 14, borderRadius: 12,
    backgroundColor: '#f1f5f9', alignItems: 'center',
  },
  btnLimpiarDark: { backgroundColor: '#2a2a2a' },
  btnLimpiarTxt: { fontWeight: '600', color: '#475569' },
  btnAplicar: { flex: 1, padding: 14, borderRadius: 12, alignItems: 'center' },
  btnAplicarTxt: { fontWeight: 'bold', fontSize: 15 },

  // List
  lista: { padding: 15, gap: 12 },
  card: {
    backgroundColor: 'white',
    borderRadius: 16,
    overflow: 'hidden',
    elevation: 3,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 2 },
  },
  cardDark: { backgroundColor: '#1e1e1e' },
  fechaBadge: { paddingHorizontal: 15, paddingVertical: 8 },
  fechaBadgeText: { fontSize: 13, fontWeight: 'bold', textTransform: 'capitalize' },
  cardContent: { flexDirection: 'row', alignItems: 'center', padding: 15, gap: 12 },
  emojiText: { fontSize: 32 },
  textoContainer: { flex: 1 },
  nombre: { fontSize: 17, fontWeight: 'bold', color: '#1e293b' },
  textDark: { color: '#f1f1f1' },
  concejo: { color: '#64748b', fontSize: 14, marginTop: 3 },
  orquesta: { color: '#64748b', fontSize: 13, marginTop: 2 },
  subTextDark: { color: '#aaa' },
  flecha: { fontSize: 28, color: '#cbd5e1', fontWeight: '300' },

  // Calendar wrapper
  calendarWrapper: { flex: 1, paddingHorizontal: 12, paddingTop: 10 },

  // Month navigation
  monthNav: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', marginBottom: 16,
  },
  navBtn: { padding: 8 },
  navArrow: { fontSize: 34, lineHeight: 36 },
  monthTitle: { fontSize: 18, fontWeight: 'bold', color: '#1e293b' },

  // Week header
  weekHeader: {
    flexDirection: 'row', marginBottom: 6,
  },
  weekDay: {
    flex: 1, textAlign: 'center',
    fontSize: 12, fontWeight: '600', color: '#94a3b8',
  },

  // Day grid
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  dayCell: {
    width: '14.28%',
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 2,
  },
  dayCellToday: {
    borderWidth: 1.5,
    borderColor: 'transparent',
    borderRadius: 10,
  },
  dayNum: { fontSize: 15, color: '#334155' },
  dot: {
    width: 5, height: 5, borderRadius: 3,
    marginTop: 2,
  },

  // Selected day
  selectedSection: { marginTop: 20 },
  selectedTitle: {
    fontSize: 16, fontWeight: 'bold', color: '#1e293b',
    marginBottom: 12,
  },
  sinFiestas: {
    color: '#94a3b8', fontSize: 14, textAlign: 'center',
    paddingVertical: 20,
  },

  // States
  loader: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  vacio: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 30 },
  vacioEmoji: { fontSize: 60, marginBottom: 15 },
  vacioText: { fontSize: 18, color: '#64748b', textAlign: 'center' },
});
