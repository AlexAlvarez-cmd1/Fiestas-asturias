import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator, Alert, Dimensions, Image, ImageBackground, Modal,
  ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import ImageModal from '../../components/ImageModal';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { useAuth } from '../../contexts/AuthContext';
import { useConfig } from '../../contexts/ConfigContext';
import { storage } from '../../firebaseConfig';
import { authService } from '../../services/authService';
import { cacheService } from '../../services/cacheService';
import { favoritesService } from '../../services/favoritesService';
import { LOGROS_DEF, logrosService } from '../../services/logrosService';
import { userService } from '../../services/userService';

const SCREEN_WIDTH = Dimensions.get('window').width;
const BANNER_HEIGHT = Math.round(SCREEN_WIDTH / 3);

export default function PantallaPerfil() {
  const router = useRouter();
  const { user, userProfile, refreshProfile } = useAuth();
  const { primaryColor, textColor, theme } = useConfig();
  const isDark = theme === 'dark';

  const [amigos, setAmigos] = useState([]);
  const [solicitudes, setSolicitudes] = useState([]);
  const [busqueda, setBusqueda] = useState('');
  const [resultados, setResultados] = useState([]);
  const [buscando, setBuscando] = useState(false);
  const [cargando, setCargando] = useState(true);
  const [tab, setTab] = useState('amigos');
  const [stats, setStats] = useState({ favoritas: 0, asistidas: 0 });
  const [historial, setHistorial] = useState([]);
  const [logros, setLogros] = useState([]);
  const [subiendoFoto, setSubiendoFoto] = useState(false);
  const [subiendoBanner, setSubiendoBanner] = useState(false);
  const [bannerAmpliad, setBannerAmpliad] = useState(false);
  const [logroInfo, setLogroInfo] = useState(null);

  useEffect(() => {
    if (!user) return;
    cargarDatos();
    cargarStats();
  }, [user]);

  const cargarStats = async () => {
    try {
      const [favs, keys] = await Promise.all([
        favoritesService.getFavorites(),
        AsyncStorage.getAllKeys(),
      ]);
      const asistidas = keys.filter(k => k.startsWith('attended_')).length;
      setStats({ favoritas: favs?.length || 0, asistidas });
    } catch (e) {
      console.warn('Error cargando stats:', e);
    }
  };

  const cargarDatos = async () => {
    setCargando(true);
    try {
      const [friendsList, pendingList, fiestas, seguidas] = await Promise.all([
        userService.getFriends(user.uid),
        userService.getPendingRequests(user.uid),
        cacheService.getCachedFiestas(),
        logrosService.getOrquestasList(),
      ]);

      setAmigos(friendsList);
      setSolicitudes(pendingList);

      // Build historial from userProfile.asistencias + fiestas cache
      const asistencias = userProfile?.asistencias || [];
      if (fiestas && asistencias.length > 0) {
        const fiestasAsistidas = fiestas
          .filter(f => asistencias.includes(f.id))
          .sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
        setHistorial(fiestasAsistidas);

        // Compute logros
        const concejos = logrosService.countConcejosVisitados(asistencias, fiestas);
        const favs = await favoritesService.getFavorites();
        const computed = logrosService.compute({
          asistencias,
          favoritos: favs?.length || 0,
          amigos: friendsList.length,
          fotos: userProfile?.numFotos || 0,
          concejos,
          orquestas: seguidas.length,
        });
        setLogros(computed);

        // Sync newly unlocked to Firestore
        const currentLogros = userProfile?.logros || [];
        logrosService.syncToFirestore(user.uid, currentLogros, computed).catch(() => {});
      }
    } catch (e) {
      console.warn('Error cargando datos:', e);
    } finally {
      setCargando(false);
    }
  };

  const buscarUsuarios = async () => {
    if (busqueda.trim().length < 2) return;
    setBuscando(true);
    try {
      const res = await userService.searchByUsername(busqueda.trim().toLowerCase());
      setResultados(res.filter(u => u.uid !== user.uid));
    } catch (e) {
      console.warn('Error buscando:', e);
    } finally {
      setBuscando(false);
    }
  };

  const enviarSolicitud = async (otherUid) => {
    try {
      await userService.sendFriendRequest(user.uid, otherUid);
      Alert.alert('✅ Solicitud enviada');
      setResultados(prev => prev.filter(u => u.uid !== otherUid));
    } catch (e) {
      Alert.alert('Error', 'No se pudo enviar la solicitud');
    }
  };

  const aceptarSolicitud = async (otherUid) => {
    try {
      await userService.acceptFriendRequest(user.uid, otherUid);
      await cargarDatos();
    } catch (e) {
      Alert.alert('Error', 'No se pudo aceptar');
    }
  };

  const rechazarSolicitud = async (otherUid) => {
    try {
      await userService.rejectFriendRequest(user.uid, otherUid);
      setSolicitudes(prev => prev.filter(s => s.requestedBy !== otherUid));
    } catch (e) {
      Alert.alert('Error', 'No se pudo rechazar');
    }
  };

  const subirImagen = async (uri, path, field, setLoading) => {
    setLoading(true);
    try {
      const response = await fetch(uri);
      const blob = await response.blob();
      const storageRef = ref(storage, path);
      await uploadBytes(storageRef, blob);
      const url = await getDownloadURL(storageRef);
      await userService.updateProfile(user.uid, { [field]: url });
      await refreshProfile();
    } catch (e) {
      Alert.alert('Error', 'No se pudo subir la imagen.');
    } finally {
      setLoading(false);
    }
  };

  const pickFotoPerfil = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') return;
    Alert.alert('Foto de perfil', '¿Desde dónde?', [
      {
        text: '📷 Cámara', onPress: async () => {
          const cam = await ImagePicker.requestCameraPermissionsAsync();
          if (cam.status !== 'granted') return;
          const r = await ImagePicker.launchCameraAsync({ quality: 0.7, allowsEditing: true, aspect: [1, 1] });
          if (!r.canceled) subirImagen(r.assets[0].uri, `perfiles/${user.uid}/photo.jpg`, 'photoURL', setSubiendoFoto);
        }
      },
      {
        text: '🖼️ Galería', onPress: async () => {
          const r = await ImagePicker.launchImageLibraryAsync({ quality: 0.7, allowsEditing: true, aspect: [1, 1] });
          if (!r.canceled) subirImagen(r.assets[0].uri, `perfiles/${user.uid}/photo.jpg`, 'photoURL', setSubiendoFoto);
        }
      },
      { text: 'Cancelar', style: 'cancel' },
    ]);
  };

  const pickBanner = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') return;
    Alert.alert('Banner', '¿Desde dónde?', [
      {
        text: '📷 Cámara', onPress: async () => {
          const cam = await ImagePicker.requestCameraPermissionsAsync();
          if (cam.status !== 'granted') return;
          const r = await ImagePicker.launchCameraAsync({ quality: 0.7, allowsEditing: true, aspect: [16, 5] });
          if (!r.canceled) subirImagen(r.assets[0].uri, `perfiles/${user.uid}/banner.jpg`, 'bannerURL', setSubiendoBanner);
        },
      },
      {
        text: '🖼️ Galería', onPress: async () => {
          const r = await ImagePicker.launchImageLibraryAsync({ quality: 0.7, allowsEditing: true, aspect: [16, 5] });
          if (!r.canceled) subirImagen(r.assets[0].uri, `perfiles/${user.uid}/banner.jpg`, 'bannerURL', setSubiendoBanner);
        },
      },
      { text: 'Cancelar', style: 'cancel' },
    ]);
  };

  const [zoomVisible, setZoomVisible] = useState(false);

  const handleLogout = () => {
    Alert.alert('Cerrar sesión', '¿Seguro que quieres salir?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Salir', style: 'destructive',
        onPress: async () => {
          await authService.logout();
          router.replace('/auth/login');
        },
      },
    ]);
  };

  const iniciales = (name) =>
    (name || '?').split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);

  const displayName = userProfile?.username || user?.email?.split('@')[0] || '?';

  useEffect(() => {
    if (userProfile?.photoURL) Image.prefetch(userProfile.photoURL);
    if (userProfile?.bannerURL) Image.prefetch(userProfile.bannerURL);
  }, [userProfile?.photoURL, userProfile?.bannerURL]);

  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const historialProximas = historial.filter(f => new Date(f.fecha) >= hoy);
  const historialPasadas = historial.filter(f => new Date(f.fecha) < hoy);

  return (
    <SafeAreaView style={[styles.container, isDark && styles.containerDark]} edges={['top']}>

      {/* CABECERA */}
      <View style={[styles.headerWrapper, isDark && styles.headerWrapperDark]}>
        <View>
          <TouchableOpacity
            onPress={() => userProfile?.bannerURL && setBannerAmpliad(true)}
            activeOpacity={userProfile?.bannerURL ? 0.92 : 1}
          >
            <ImageBackground
              source={userProfile?.bannerURL ? { uri: userProfile.bannerURL } : null}
              style={[styles.banner, !userProfile?.bannerURL && { backgroundColor: primaryColor }]}
            >
              <View style={styles.bannerGradient} />
              {subiendoBanner && <ActivityIndicator color="white" size="large" style={StyleSheet.absoluteFill} />}
            </ImageBackground>
          </TouchableOpacity>
          {(userProfile?.isAdmin === true || userProfile?.isAdmin === 'true') && (
            <TouchableOpacity style={styles.btnAdmin} onPress={() => router.push('/admin')}>
              <Text style={styles.btnAdminTxt}>⚙️</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity style={styles.btnSalir} onPress={handleLogout}>
            <Text style={styles.btnSalirTxt}>Salir</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.btnCambiarBanner} onPress={pickBanner}>
            <Text style={styles.btnCambiarBannerTxt}>🖼️</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.avatarCentrado}>
          <TouchableOpacity onPress={() => userProfile?.photoURL && setZoomVisible(true)} activeOpacity={0.85}>
            {subiendoFoto ? (
              <View style={[styles.avatarCircle, { backgroundColor: primaryColor }]}>
                <ActivityIndicator color="white" />
              </View>
            ) : userProfile?.photoURL ? (
              <Image source={{ uri: userProfile.photoURL }} style={styles.avatarImg} />
            ) : (
              <View style={[styles.avatarCircle, { backgroundColor: primaryColor }]}>
                <Text style={styles.avatarText}>{iniciales(displayName)}</Text>
              </View>
            )}
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.avatarEditBadge, { backgroundColor: primaryColor }]}
            onPress={pickFotoPerfil}
          >
            <Text style={{ fontSize: 12, color: textColor }}>📷</Text>
          </TouchableOpacity>
        </View>

        <Text style={[styles.nombreUsuario, isDark && styles.textDark]}>{displayName}</Text>

        {/* STATS */}
        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Text style={[styles.statNum, { color: primaryColor }]}>{stats.asistidas}</Text>
            <Text style={[styles.statLabel, isDark && styles.textDark]}>asistidas</Text>
          </View>
          <View style={[styles.statDivider, isDark && { backgroundColor: '#444' }]} />
          <View style={styles.statItem}>
            <Text style={[styles.statNum, { color: primaryColor }]}>{stats.favoritas}</Text>
            <Text style={[styles.statLabel, isDark && styles.textDark]}>favoritas</Text>
          </View>
          <View style={[styles.statDivider, isDark && { backgroundColor: '#444' }]} />
          <View style={styles.statItem}>
            <Text style={[styles.statNum, { color: primaryColor }]}>{amigos.length}</Text>
            <Text style={[styles.statLabel, isDark && styles.textDark]}>amigos</Text>
          </View>
        </View>

        {/* LOGROS (fila horizontal) */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.logrosRow}
        >
          {LOGROS_DEF.map(logro => {
            const unlocked = logros.includes(logro.id);
            return (
              <TouchableOpacity
                key={logro.id}
                style={[styles.logroBadge, unlocked && { borderColor: primaryColor }]}
                onPress={() => setLogroInfo(logro)}
                activeOpacity={0.8}
              >
                <Text style={[styles.logroEmoji, !unlocked && styles.logroLocked]}>
                  {logro.emoji}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* TABS */}
      <View style={[styles.tabs, isDark && styles.tabsDark]}>
        {[
          { key: 'amigos', label: `👥 Amigos${solicitudes.length > 0 ? ` (${solicitudes.length} 🔔)` : ''}` },
          { key: 'buscar', label: '🔍 Buscar' },
          { key: 'historial', label: '📅 Historial' },
        ].map(t => (
          <TouchableOpacity
            key={t.key}
            style={[styles.tabBtn, tab === t.key && { borderBottomColor: primaryColor, borderBottomWidth: 2.5 }]}
            onPress={() => setTab(t.key)}
          >
            <Text style={[styles.tabTxt, isDark && styles.textDark, tab === t.key && { color: primaryColor, fontWeight: 'bold' }]}>
              {t.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* CONTENIDO TABS */}
      {tab === 'amigos' && (
        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
          {solicitudes.length > 0 && (
            <View style={styles.seccion}>
              <Text style={[styles.seccionTitulo, isDark && styles.textDark]}>Solicitudes pendientes</Text>
              {solicitudes.map((s) => (
                <View key={s.requestedBy} style={[styles.card, isDark && styles.cardDark]}>
                  <View style={[styles.miniAvatar, { backgroundColor: primaryColor }]}>
                    <Text style={{ color: textColor, fontWeight: 'bold', fontSize: 13 }}>
                      {iniciales(s.requesterProfile?.username)}
                    </Text>
                  </View>
                  <Text style={[styles.cardNombre, isDark && styles.textDark, { flex: 1 }]}>
                    {s.requesterProfile?.username || '?'}
                  </Text>
                  <TouchableOpacity
                    style={[styles.btnAccion, { backgroundColor: primaryColor }]}
                    onPress={() => aceptarSolicitud(s.requestedBy)}
                  >
                    <Text style={{ color: textColor, fontWeight: 'bold', fontSize: 12 }}>Aceptar</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.btnRechazar} onPress={() => rechazarSolicitud(s.requestedBy)}>
                    <Text style={{ color: '#ef4444', fontWeight: 'bold', fontSize: 16 }}>✕</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )}

          <View style={styles.seccion}>
            <Text style={[styles.seccionTitulo, isDark && styles.textDark]}>Mis amigos</Text>
            {cargando ? (
              <ActivityIndicator color={primaryColor} style={{ marginTop: 20 }} />
            ) : amigos.length === 0 ? (
              <View style={styles.vacioCont}>
                <Text style={styles.vacioEmoji}>🤝</Text>
                <Text style={[styles.vacioText, isDark && styles.textDark]}>
                  Aún no tienes amigos.{'\n'}Búscalos en la pestaña de búsqueda.
                </Text>
              </View>
            ) : (
              amigos.map((amigo) => (
                <View key={amigo.uid} style={[styles.card, isDark && styles.cardDark]}>
                  <View style={[styles.miniAvatar, { backgroundColor: primaryColor }]}>
                    <Text style={{ color: textColor, fontWeight: 'bold', fontSize: 14 }}>
                      {iniciales(amigo.username)}
                    </Text>
                  </View>
                  <Text style={[styles.cardNombre, isDark && styles.textDark, { flex: 1 }]}>{amigo.username}</Text>
                </View>
              ))
            )}
          </View>
        </ScrollView>
      )}

      {tab === 'buscar' && (
        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
          <View style={styles.seccion}>
            <Text style={[styles.seccionTitulo, isDark && styles.textDark]}>Buscar usuarios</Text>
            <View style={styles.rowBusqueda}>
              <TextInput
                style={[styles.inputBusqueda, isDark && styles.inputDark]}
                placeholder="Nombre de usuario..."
                placeholderTextColor={isDark ? '#666' : '#aaa'}
                value={busqueda}
                onChangeText={setBusqueda}
                onSubmitEditing={buscarUsuarios}
                returnKeyType="search"
              />
              <TouchableOpacity style={[styles.btnBuscar, { backgroundColor: primaryColor }]} onPress={buscarUsuarios}>
                <Text style={{ color: textColor, fontWeight: 'bold' }}>Buscar</Text>
              </TouchableOpacity>
            </View>
            {buscando && <ActivityIndicator color={primaryColor} style={{ marginTop: 15 }} />}
            {resultados.length === 0 && busqueda.length >= 2 && !buscando && (
              <Text style={[styles.vacioText, isDark && styles.textDark, { marginTop: 20, textAlign: 'center' }]}>
                No se encontraron usuarios
              </Text>
            )}
            {resultados.map((u) => (
              <View key={u.uid} style={[styles.card, isDark && styles.cardDark]}>
                <View style={[styles.miniAvatar, { backgroundColor: primaryColor }]}>
                  <Text style={{ color: textColor, fontWeight: 'bold', fontSize: 14 }}>{iniciales(u.username)}</Text>
                </View>
                <Text style={[styles.cardNombre, isDark && styles.textDark, { flex: 1 }]}>{u.username}</Text>
                <TouchableOpacity
                  style={[styles.btnAccion, { backgroundColor: primaryColor }]}
                  onPress={() => enviarSolicitud(u.uid)}
                >
                  <Text style={{ color: textColor, fontWeight: 'bold', fontSize: 12 }}>+ Agregar</Text>
                </TouchableOpacity>
              </View>
            ))}
          </View>
        </ScrollView>
      )}

      {tab === 'historial' && (
        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
          {historial.length === 0 ? (
            <View style={styles.vacioCont}>
              <Text style={styles.vacioEmoji}>🎪</Text>
              <Text style={[styles.vacioText, isDark && styles.textDark]}>
                Aún no has marcado asistencia a ninguna fiesta.
              </Text>
            </View>
          ) : (
            <>
              {historialProximas.length > 0 && (
                <View style={styles.seccion}>
                  <Text style={[styles.seccionTitulo, isDark && styles.textDark]}>📅 Próximas</Text>
                  {historialProximas.map(f => <FiestaHistorialCard key={f.id} fiesta={f} router={router} isDark={isDark} primaryColor={primaryColor} textColor={textColor} />)}
                </View>
              )}
              {historialPasadas.length > 0 && (
                <View style={styles.seccion}>
                  <Text style={[styles.seccionTitulo, isDark && styles.textDark]}>✅ Asistidas</Text>
                  {historialPasadas.map(f => <FiestaHistorialCard key={f.id} fiesta={f} router={router} isDark={isDark} primaryColor={primaryColor} textColor={textColor} />)}
                </View>
              )}
            </>
          )}
        </ScrollView>
      )}

      <ImageModal
        visible={bannerAmpliad}
        onClose={() => setBannerAmpliad(false)}
        imageUrl={userProfile?.bannerURL}
        footer={
          <TouchableOpacity
            style={styles.btnEditarEnModal}
            onPress={() => { setBannerAmpliad(false); setTimeout(pickBanner, 200); }}
          >
            <Text style={styles.btnEditarEnModalTxt}>🖼️ Cambiar banner</Text>
          </TouchableOpacity>
        }
      />

      <ImageModal
        visible={zoomVisible}
        onClose={() => setZoomVisible(false)}
        imageUrl={userProfile?.photoURL}
        footer={
          <TouchableOpacity
            style={styles.btnEditarEnModal}
            onPress={() => { setZoomVisible(false); setTimeout(pickFotoPerfil, 200); }}
          >
            <Text style={styles.btnEditarEnModalTxt}>📷 Cambiar foto de perfil</Text>
          </TouchableOpacity>
        }
      />

      {/* TOOLTIP LOGRO */}
      <Modal visible={!!logroInfo} transparent animationType="fade" onRequestClose={() => setLogroInfo(null)}>
        <TouchableOpacity style={styles.logroModalFondo} activeOpacity={1} onPress={() => setLogroInfo(null)}>
          <View style={[styles.logroModalCard, isDark && styles.cardDark]}>
            <Text style={styles.logroModalEmoji}>{logroInfo?.emoji}</Text>
            <Text style={[styles.logroModalTitulo, isDark && styles.textDark]}>{logroInfo?.titulo}</Text>
            <Text style={[styles.logroModalDesc, isDark && { color: '#aaa' }]}>{logroInfo?.desc}</Text>
            {logroInfo && (
              <View style={[styles.logroEstado, logros.includes(logroInfo.id) ? { backgroundColor: '#dcfce7' } : { backgroundColor: '#f1f5f9' }]}>
                <Text style={[styles.logroEstadoTxt, logros.includes(logroInfo.id) ? { color: '#166534' } : { color: '#94a3b8' }]}>
                  {logros.includes(logroInfo.id) ? '✅ Desbloqueado' : '🔒 Bloqueado'}
                </Text>
              </View>
            )}
          </View>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}

function FiestaHistorialCard({ fiesta, router, isDark, primaryColor, textColor }) {
  const fecha = new Date(fiesta.fecha).toLocaleDateString('es-ES', {
    weekday: 'short', day: 'numeric', month: 'short',
  });
  return (
    <TouchableOpacity
      style={[styles.card, isDark && styles.cardDark, { overflow: 'hidden' }]}
      onPress={() => router.push({
        pathname: '/detalle',
        params: {
          id: fiesta.id, nombre: fiesta.nombre, concejo: fiesta.concejo,
          fecha: fiesta.fecha, orquesta: fiesta.orquesta, imagen: fiesta.imagen,
          latitud: fiesta.ubicacion?.latitude, longitud: fiesta.ubicacion?.longitude,
        },
      })}
      activeOpacity={0.7}
    >
      <View style={[styles.histFechaBand, { backgroundColor: primaryColor }]}>
        <Text style={[{ fontSize: 11, fontWeight: 'bold', textTransform: 'capitalize' }, { color: textColor }]}>{fecha}</Text>
      </View>
      <View style={styles.histContent}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.cardNombre, isDark && styles.textDark]} numberOfLines={1}>{fiesta.nombre}</Text>
          <Text style={[styles.histConcejo, isDark && { color: '#888' }]}>📍 {fiesta.concejo}</Text>
        </View>
        <Text style={[{ fontSize: 20, color: '#cbd5e1' }]}>›</Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f4f4f4' },
  containerDark: { backgroundColor: '#121212' },
  headerWrapper: { backgroundColor: 'white', paddingBottom: 6 },
  headerWrapperDark: { backgroundColor: '#1a1a1a' },
  banner: { width: '100%', height: BANNER_HEIGHT },
  bannerGradient: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.18)' },
  btnAdmin: { position: 'absolute', top: 12, right: 74, backgroundColor: 'rgba(0,0,0,0.4)', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20 },
  btnAdminTxt: { fontSize: 16 },
  btnSalir: { position: 'absolute', top: 12, right: 14, backgroundColor: 'rgba(0,0,0,0.4)', paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20 },
  btnSalirTxt: { color: 'white', fontSize: 13, fontWeight: '600' },
  btnCambiarBanner: { position: 'absolute', top: 12, left: 14, backgroundColor: 'rgba(0,0,0,0.4)', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 20 },
  btnCambiarBannerTxt: { fontSize: 16 },
  avatarCentrado: { alignItems: 'center', marginTop: -48, marginBottom: 10, position: 'relative' },
  avatarCircle: { width: 96, height: 96, borderRadius: 48, justifyContent: 'center', alignItems: 'center', borderWidth: 4, borderColor: 'white' },
  avatarImg: { width: 96, height: 96, borderRadius: 48, borderWidth: 4, borderColor: 'white' },
  avatarText: { fontSize: 32, fontWeight: 'bold', color: 'white' },
  avatarEditBadge: { position: 'absolute', bottom: 0, right: SCREEN_WIDTH / 2 - 58, width: 28, height: 28, borderRadius: 14, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: 'white' },
  nombreUsuario: { fontSize: 22, fontWeight: 'bold', color: '#1e293b', textAlign: 'center', marginBottom: 14 },
  statsRow: { flexDirection: 'row', paddingVertical: 12, paddingHorizontal: 20, borderTopWidth: 1, borderTopColor: '#f0f0f0' },
  statItem: { flex: 1, alignItems: 'center' },
  statNum: { fontSize: 22, fontWeight: 'bold' },
  statLabel: { fontSize: 12, marginTop: 3, color: '#94a3b8' },
  statDivider: { width: 1, backgroundColor: '#e5e5e5', marginHorizontal: 4 },

  // Logros row
  logrosRow: { paddingHorizontal: 14, paddingVertical: 10, gap: 8 },
  logroBadge: {
    width: 46, height: 46, borderRadius: 23,
    borderWidth: 2, borderColor: '#e5e5e5',
    justifyContent: 'center', alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.03)',
  },
  logroEmoji: { fontSize: 22 },
  logroLocked: { opacity: 0.25 },

  // Tabs
  tabs: { flexDirection: 'row', backgroundColor: 'white', borderBottomWidth: 1, borderBottomColor: '#e5e5e5' },
  tabsDark: { backgroundColor: '#1e1e1e', borderBottomColor: '#333' },
  tabBtn: { flex: 1, paddingVertical: 13, alignItems: 'center' },
  tabTxt: { fontSize: 12, fontWeight: '500', color: '#666' },
  textDark: { color: '#f1f1f1' },
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: 30 },
  seccion: { padding: 16 },
  seccionTitulo: { fontSize: 16, fontWeight: 'bold', color: '#1e293b', marginBottom: 12 },
  card: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: 'white',
    borderRadius: 14, marginBottom: 10,
    elevation: 2, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 4, shadowOffset: { width: 0, height: 1 },
  },
  cardDark: { backgroundColor: '#1e1e1e' },
  miniAvatar: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center', marginRight: 12, marginLeft: 12 },
  cardNombre: { fontSize: 15, fontWeight: '600', color: '#1e293b' },
  btnAccion: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 10, marginLeft: 8 },
  btnRechazar: { paddingHorizontal: 10, paddingVertical: 6, marginLeft: 4, marginRight: 6 },
  vacioCont: { alignItems: 'center', paddingVertical: 30 },
  vacioEmoji: { fontSize: 48, marginBottom: 12 },
  vacioText: { color: '#94a3b8', fontSize: 15, textAlign: 'center', lineHeight: 22 },
  rowBusqueda: { flexDirection: 'row', gap: 10, marginBottom: 8 },
  inputBusqueda: { flex: 1, backgroundColor: 'white', borderRadius: 12, padding: 12, fontSize: 15, borderWidth: 1, borderColor: '#e2e8f0', color: '#333' },
  inputDark: { backgroundColor: '#2c2c2c', borderColor: '#444', color: '#f1f1f1' },
  btnBuscar: { paddingHorizontal: 16, borderRadius: 12, justifyContent: 'center', minHeight: 46 },

  // Historial card
  histFechaBand: { paddingHorizontal: 12, paddingVertical: 7 },
  histContent: { flexDirection: 'row', alignItems: 'center', flex: 1, padding: 12, gap: 8 },
  histConcejo: { fontSize: 13, color: '#64748b', marginTop: 2 },

  // Logro modal
  logroModalFondo: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  logroModalCard: { backgroundColor: 'white', borderRadius: 20, padding: 28, alignItems: 'center', width: '75%' },
  logroModalEmoji: { fontSize: 52, marginBottom: 10 },
  logroModalTitulo: { fontSize: 20, fontWeight: 'bold', color: '#1e293b', marginBottom: 6 },
  logroModalDesc: { fontSize: 14, color: '#64748b', textAlign: 'center', lineHeight: 20, marginBottom: 16 },
  logroEstado: { paddingHorizontal: 16, paddingVertical: 7, borderRadius: 20 },
  logroEstadoTxt: { fontSize: 13, fontWeight: '600' },

  btnEditarEnModal: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.35)',
    paddingHorizontal: 28,
    paddingVertical: 13,
    borderRadius: 24,
  },
  btnEditarEnModalTxt: { color: 'white', fontWeight: '600', fontSize: 15 },
});
