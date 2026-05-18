import { collection, deleteDoc, doc, getDocs, query, updateDoc, where } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator, Alert, FlatList, ScrollView, StyleSheet,
  Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAuth } from '../../contexts/AuthContext';
import { db } from '../../firebaseConfig';

export default function AdminPanel() {
  const router = useRouter();
  const { userProfile } = useAuth();
  const [seccion, setSeccion] = useState('fiestas'); // 'fiestas' | 'usuarios'

  // ── Fiestas state ─────────────────────────────────────────────────────────
  const [fiestas, setFiestas] = useState([]);
  const [cargandoFiestas, setCargandoFiestas] = useState(true);
  const [busquedaFiesta, setBusquedaFiesta] = useState('');

  // ── Usuarios state ────────────────────────────────────────────────────────
  const [busquedaUser, setBusquedaUser] = useState('');
  const [usuarios, setUsuarios] = useState([]);
  const [cargandoUsers, setCargandoUsers] = useState(false);
  const [toggling, setToggling] = useState(null); // uid en proceso

  const esAdmin = userProfile?.isAdmin === true;

  useEffect(() => { cargarFiestas(); }, []);

  // ── Fiestas ───────────────────────────────────────────────────────────────

  const cargarFiestas = async () => {
    setCargandoFiestas(true);
    try {
      const snap = await getDocs(collection(db, 'fiestas'));
      const data = snap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .sort((a, b) => (a.fecha || '').localeCompare(b.fecha || ''));
      setFiestas(data);
    } catch {
      Alert.alert('Error', 'No se pudieron cargar las fiestas.');
    }
    setCargandoFiestas(false);
  };

  const eliminar = (fiesta) => {
    Alert.alert('¿Eliminar fiesta?', `"${fiesta.nombre}" se eliminará permanentemente.`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar', style: 'destructive',
        onPress: async () => {
          try {
            await deleteDoc(doc(db, 'fiestas', fiesta.id));
            setFiestas(prev => prev.filter(f => f.id !== fiesta.id));
          } catch {
            Alert.alert('Error', 'No se pudo eliminar la fiesta.');
          }
        },
      },
    ]);
  };

  const irEditar = (fiesta) => {
    router.push({
      pathname: '/editar',
      params: {
        id: fiesta.id, nombre: fiesta.nombre, concejo: fiesta.concejo,
        fecha: fiesta.fecha, orquesta: fiesta.orquesta || '',
        imagen: fiesta.imagen || '',
        latitud: fiesta.ubicacion?.latitude, longitud: fiesta.ubicacion?.longitude,
        esVersity: fiesta.esVersity || 'false', linkVersity: fiesta.linkVersity || '',
      },
    });
  };

  // ── Usuarios ──────────────────────────────────────────────────────────────

  const buscarUsuarios = async () => {
    const q = busquedaUser.trim();
    if (!q) return;
    setCargandoUsers(true);
    try {
      const snap = await getDocs(
        query(
          collection(db, 'users'),
          where('username', '>=', q),
          where('username', '<=', q + ''),
        )
      );
      setUsuarios(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch {
      Alert.alert('Error', 'No se pudo buscar. Comprueba los índices de Firestore.');
    }
    setCargandoUsers(false);
  };

  const toggleAdmin = async (usuario) => {
    const nuevoValor = !(usuario.isAdmin === true);
    setToggling(usuario.id);
    try {
      await updateDoc(doc(db, 'users', usuario.id), { isAdmin: nuevoValor });
      setUsuarios(prev =>
        prev.map(u => u.id === usuario.id ? { ...u, isAdmin: nuevoValor } : u)
      );
    } catch {
      Alert.alert('Error', 'No se pudieron cambiar los permisos.');
    }
    setToggling(null);
  };

  // ── Access denied ─────────────────────────────────────────────────────────

  if (!esAdmin) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.denegadoWrap}>
          <Text style={styles.denegadoEmoji}>🔒</Text>
          <Text style={styles.denegadoTxt}>Acceso restringido</Text>
          <Text style={styles.denegadoSub}>Necesitas permisos de administrador</Text>
          <TouchableOpacity style={styles.btnVolver} onPress={() => router.back()}>
            <Text style={styles.btnVolverTxt}>← Volver</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // ── Stats ─────────────────────────────────────────────────────────────────

  const hoy = new Date().toISOString().split('T')[0];
  const proximas = fiestas.filter(f => (f.fecha || '') >= hoy).length;
  const fiestasFiltr = fiestas.filter(f => {
    if (!busquedaFiesta.trim()) return true;
    const q = busquedaFiesta.toLowerCase();
    return (f.nombre || '').toLowerCase().includes(q) ||
           (f.concejo || '').toLowerCase().includes(q) ||
           (f.orquesta || '').toLowerCase().includes(q);
  });

  return (
    <SafeAreaView style={styles.container}>

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backTxt}>← Volver</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>⚙️ Administración</Text>
        {seccion === 'fiestas' && (
          <TouchableOpacity style={styles.btnNueva} onPress={() => router.push('/nueva')}>
            <Text style={styles.btnNuevaTxt}>+ Nueva</Text>
          </TouchableOpacity>
        )}
        {seccion === 'usuarios' && <View style={{ width: 70 }} />}
      </View>

      {/* Tabs */}
      <View style={styles.tabs}>
        <TouchableOpacity
          style={[styles.tab, seccion === 'fiestas' && styles.tabActive]}
          onPress={() => setSeccion('fiestas')}
        >
          <Text style={[styles.tabTxt, seccion === 'fiestas' && styles.tabTxtActive]}>🎪 Fiestas</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, seccion === 'usuarios' && styles.tabActive]}
          onPress={() => setSeccion('usuarios')}
        >
          <Text style={[styles.tabTxt, seccion === 'usuarios' && styles.tabTxtActive]}>👥 Usuarios</Text>
        </TouchableOpacity>
      </View>

      {/* ── SECCIÓN FIESTAS ── */}
      {seccion === 'fiestas' && (
        <>
          <View style={styles.statsRow}>
            <View style={styles.statBox}>
              <Text style={styles.statNum}>{fiestas.length}</Text>
              <Text style={styles.statLbl}>Total</Text>
            </View>
            <View style={[styles.statBox, styles.statBoxGreen]}>
              <Text style={[styles.statNum, { color: '#166534' }]}>{proximas}</Text>
              <Text style={styles.statLbl}>Próximas</Text>
            </View>
            <View style={[styles.statBox, styles.statBoxGray]}>
              <Text style={[styles.statNum, { color: '#94a3b8' }]}>{fiestas.length - proximas}</Text>
              <Text style={styles.statLbl}>Pasadas</Text>
            </View>
          </View>

          <TextInput
            style={styles.search}
            placeholder="🔍  Buscar fiesta, concejo u orquesta..."
            placeholderTextColor="#94a3b8"
            value={busquedaFiesta}
            onChangeText={setBusquedaFiesta}
          />

          {cargandoFiestas ? (
            <ActivityIndicator size="large" color="#166534" style={{ marginTop: 40 }} />
          ) : (
            <FlatList
              data={fiestasFiltr}
              keyExtractor={item => item.id}
              contentContainerStyle={{ paddingBottom: 30 }}
              refreshing={cargandoFiestas}
              onRefresh={cargarFiestas}
              ListEmptyComponent={<View style={styles.vacio}><Text style={styles.vacioTxt}>Sin resultados</Text></View>}
              renderItem={({ item }) => {
                const esPasada = (item.fecha || '') < hoy;
                return (
                  <View style={[styles.row, esPasada && styles.rowPasada]}>
                    <View style={styles.rowLeft}>
                      {esPasada && <View style={styles.badgePasada}><Text style={styles.badgePasadaTxt}>Pasada</Text></View>}
                      <Text style={[styles.rowNombre, esPasada && styles.rowNombrePasada]} numberOfLines={1}>{item.nombre}</Text>
                      <Text style={styles.rowMeta}>📍 {item.concejo}  ·  📅 {item.fecha || '—'}</Text>
                      {item.orquesta ? <Text style={styles.rowOrquesta} numberOfLines={1}>🎵 {item.orquesta}</Text> : null}
                    </View>
                    <View style={styles.rowActions}>
                      <TouchableOpacity style={styles.btnEdit} onPress={() => irEditar(item)}>
                        <Text style={styles.btnEditTxt}>✏️</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.btnDel} onPress={() => eliminar(item)}>
                        <Text style={styles.btnDelTxt}>🗑️</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              }}
            />
          )}
        </>
      )}

      {/* ── SECCIÓN USUARIOS ── */}
      {seccion === 'usuarios' && (
        <ScrollView contentContainerStyle={{ paddingBottom: 30 }}>
          <View style={styles.userSearchRow}>
            <TextInput
              style={[styles.search, { flex: 1, marginBottom: 0, marginRight: 8 }]}
              placeholder="Buscar por nombre de usuario..."
              placeholderTextColor="#94a3b8"
              value={busquedaUser}
              onChangeText={setBusquedaUser}
              onSubmitEditing={buscarUsuarios}
              returnKeyType="search"
              autoCapitalize="none"
            />
            <TouchableOpacity style={styles.btnBuscar} onPress={buscarUsuarios}>
              <Text style={styles.btnBuscarTxt}>Buscar</Text>
            </TouchableOpacity>
          </View>

          {cargandoUsers && <ActivityIndicator color="#166534" style={{ marginTop: 20 }} />}

          {!cargandoUsers && usuarios.length === 0 && busquedaUser.trim() !== '' && (
            <View style={styles.vacio}>
              <Text style={styles.vacioTxt}>Sin resultados</Text>
            </View>
          )}

          {usuarios.map(u => {
            const esAdminUser = u.isAdmin === true;
            const esMismoUser = u.id === userProfile?.uid;
            return (
              <View key={u.id} style={styles.userRow}>
                <View style={styles.userInfo}>
                  <Text style={styles.userNombre}>@{u.username}</Text>
                  <Text style={styles.userEmail}>{u.email}</Text>
                  {esAdminUser && (
                    <View style={styles.badgeAdmin}>
                      <Text style={styles.badgeAdminTxt}>Admin</Text>
                    </View>
                  )}
                </View>
                <TouchableOpacity
                  style={[styles.btnToggle, esAdminUser ? styles.btnToggleOff : styles.btnToggleOn]}
                  onPress={() => toggleAdmin(u)}
                  disabled={toggling === u.id || esMismoUser}
                >
                  {toggling === u.id
                    ? <ActivityIndicator size="small" color="white" />
                    : <Text style={styles.btnToggleTxt}>
                        {esMismoUser ? '(tú)' : esAdminUser ? 'Quitar admin' : 'Dar admin'}
                      </Text>
                  }
                </TouchableOpacity>
              </View>
            );
          })}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f4f4f4' },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#166534', paddingHorizontal: 16, paddingVertical: 14,
  },
  backBtn: { padding: 4 },
  backTxt: { color: 'white', fontSize: 15 },
  headerTitle: { color: 'white', fontSize: 17, fontWeight: 'bold' },
  btnNueva: { backgroundColor: 'white', paddingHorizontal: 14, paddingVertical: 7, borderRadius: 10 },
  btnNuevaTxt: { color: '#166534', fontWeight: 'bold', fontSize: 14 },

  tabs: { flexDirection: 'row', backgroundColor: 'white', borderBottomWidth: 1, borderBottomColor: '#e5e7eb' },
  tab: { flex: 1, paddingVertical: 12, alignItems: 'center' },
  tabActive: { borderBottomWidth: 3, borderBottomColor: '#166534' },
  tabTxt: { fontSize: 14, color: '#94a3b8', fontWeight: '500' },
  tabTxtActive: { color: '#166534', fontWeight: 'bold' },

  statsRow: { flexDirection: 'row', gap: 10, margin: 14 },
  statBox: {
    flex: 1, backgroundColor: 'white', borderRadius: 14,
    alignItems: 'center', paddingVertical: 14,
    elevation: 2, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 4, shadowOffset: { width: 0, height: 2 },
  },
  statBoxGreen: { borderTopWidth: 3, borderTopColor: '#166534' },
  statBoxGray: { borderTopWidth: 3, borderTopColor: '#94a3b8' },
  statNum: { fontSize: 26, fontWeight: 'bold', color: '#1e293b' },
  statLbl: { fontSize: 12, color: '#64748b', marginTop: 2 },

  search: {
    backgroundColor: 'white', marginHorizontal: 14, marginBottom: 10,
    borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 15, color: '#1e293b',
    elevation: 1, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 3, shadowOffset: { width: 0, height: 1 },
  },

  row: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'white', marginHorizontal: 14, marginBottom: 8,
    borderRadius: 14, padding: 14, elevation: 2,
    shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 4, shadowOffset: { width: 0, height: 2 },
  },
  rowPasada: { opacity: 0.6 },
  rowLeft: { flex: 1, marginRight: 12 },
  badgePasada: { alignSelf: 'flex-start', backgroundColor: '#f1f5f9', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6, marginBottom: 4 },
  badgePasadaTxt: { fontSize: 10, color: '#94a3b8', fontWeight: '600' },
  rowNombre: { fontSize: 15, fontWeight: 'bold', color: '#1e293b' },
  rowNombrePasada: { color: '#64748b' },
  rowMeta: { fontSize: 12, color: '#64748b', marginTop: 3 },
  rowOrquesta: { fontSize: 12, color: '#94a3b8', marginTop: 2 },
  rowActions: { flexDirection: 'row', gap: 8 },
  btnEdit: { backgroundColor: '#dbeafe', width: 40, height: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  btnEditTxt: { fontSize: 18 },
  btnDel: { backgroundColor: '#fee2e2', width: 40, height: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  btnDelTxt: { fontSize: 18 },

  // Usuarios
  userSearchRow: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 14, marginTop: 14, marginBottom: 4 },
  btnBuscar: { backgroundColor: '#166534', paddingHorizontal: 16, paddingVertical: 13, borderRadius: 12 },
  btnBuscarTxt: { color: 'white', fontWeight: 'bold', fontSize: 14 },

  userRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'white', marginHorizontal: 14, marginTop: 10,
    borderRadius: 14, padding: 14, elevation: 2,
    shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 4, shadowOffset: { width: 0, height: 2 },
  },
  userInfo: { flex: 1, marginRight: 10 },
  userNombre: { fontSize: 15, fontWeight: 'bold', color: '#1e293b' },
  userEmail: { fontSize: 12, color: '#64748b', marginTop: 2 },
  badgeAdmin: { alignSelf: 'flex-start', backgroundColor: '#dcfce7', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6, marginTop: 5 },
  badgeAdminTxt: { fontSize: 11, color: '#166534', fontWeight: '700' },

  btnToggle: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 10, minWidth: 90, alignItems: 'center' },
  btnToggleOn: { backgroundColor: '#166534' },
  btnToggleOff: { backgroundColor: '#fee2e2' },
  btnToggleTxt: { color: 'white', fontWeight: 'bold', fontSize: 13 },

  vacio: { alignItems: 'center', paddingTop: 40 },
  vacioTxt: { color: '#94a3b8', fontSize: 16 },

  denegadoWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 30 },
  denegadoEmoji: { fontSize: 60, marginBottom: 16 },
  denegadoTxt: { fontSize: 20, fontWeight: 'bold', color: '#1e293b', marginBottom: 8 },
  denegadoSub: { fontSize: 15, color: '#64748b', textAlign: 'center', marginBottom: 30 },
  btnVolver: { backgroundColor: '#166534', paddingHorizontal: 24, paddingVertical: 14, borderRadius: 14 },
  btnVolverTxt: { color: 'white', fontWeight: 'bold', fontSize: 15 },
});
