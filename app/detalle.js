import * as ImagePicker from 'expo-image-picker';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { deleteDoc, doc, increment, onSnapshot, updateDoc } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Image, Linking, Modal, ScrollView, Share, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../contexts/AuthContext';
import { useConfig } from '../contexts/ConfigContext';
import { db } from '../firebaseConfig';
import { useFavorite } from '../hooks/useFavorite';
import { fotosService } from '../services/fotosService';
import { weatherService } from '../services/weatherService';
import { notificationService } from '../services/notificationService';
import { storageService } from '../services/storageService';
import { userService } from '../services/userService';

export default function PantallaDetalle() {
  const router = useRouter();
  const params = useLocalSearchParams();
  
  const { id, nombre, concejo, orquesta, imagen, latitud, longitud, fecha, linkVersity, esVersity } = params;
  
  const { user, userProfile } = useAuth();

  const [modalVisible, setModalVisible] = useState(false);
  const [cargandoEliminar, setCargandoEliminar] = useState(false);
  const [imagenCargada, setImagenCargada] = useState(false);

  const [fotos, setFotos] = useState([]);
  const [subiendoFoto, setSubiendoFoto] = useState(false);
  const [fotoModal, setFotoModal] = useState(null);
  const [tabDetalle, setTabDetalle] = useState('info');
  const [weather, setWeather] = useState(null);

  // Asistencia
  const [asistentesCount, setAsistentesCount] = useState(0);
  const [hasAttended, setHasAttended] = useState(false);
  const [loadingAttendance, setLoadingAttendance] = useState(true);
  
  // Hook para favoritos
  const { isFavorite, toggleFavorite, loading: loadingFavorite } = useFavorite(id);
  const { theme, primaryColor, textColor } = useConfig();
  const isDark = theme === 'dark';

  const handleToggleFavorite = async () => {
    const eraFavorito = isFavorite;
    await toggleFavorite();

    try {
      if (!eraFavorito) {
        const ids = await notificationService.scheduleAllRemindersForFiesta?.({ id, nombre, fecha, concejo });
        if (ids?.length) await storageService.setItem(`notifs_${id}`, JSON.stringify(ids));
      } else {
        const stored = await storageService.getItem(`notifs_${id}`);
        if (stored) {
          const ids = JSON.parse(stored);
          await notificationService.cancelAllRemindersForFiesta?.(ids);
          await storageService.removeItem(`notifs_${id}`);
        }
      }
    } catch (e) {
      console.warn('Notificación no disponible:', e);
    }
  };

  useEffect(() => {
    if (!id) return;
    updateDoc(doc(db, 'fiestas', id), { vistas: increment(1) }).catch(() => {});
    cargarFotos();
    if (latitud && longitud && fecha) {
      weatherService.getForecast(latitud, longitud, fecha).then(setWeather);
    }
  }, [id]);

  const cargarFotos = async () => {
    try {
      const data = await fotosService.getFotos(id);
      setFotos(data);
    } catch (e) {
      console.warn('Error cargando fotos:', e);
    }
  };

  const handleSubirFoto = async () => {
    if (!user) return Alert.alert('Inicia sesión', 'Necesitas una cuenta para subir fotos.');

    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      return Alert.alert('Permiso necesario', 'Necesitamos acceso a tu galería para subir fotos.');
    }

    Alert.alert('Subir foto', '¿Desde dónde quieres subir?', [
      {
        text: '📷 Cámara',
        onPress: async () => {
          const camStatus = await ImagePicker.requestCameraPermissionsAsync();
          if (camStatus.status !== 'granted') return;
          const result = await ImagePicker.launchCameraAsync({
            mediaTypes: 'images',
            quality: 0.7,
            allowsEditing: true,
            aspect: [4, 3],
          });
          if (!result.canceled) await subirImagen(result.assets[0].uri);
        },
      },
      {
        text: '🖼️ Galería',
        onPress: async () => {
          const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: 'images',
            quality: 0.7,
            allowsEditing: true,
            aspect: [4, 3],
          });
          if (!result.canceled) await subirImagen(result.assets[0].uri);
        },
      },
      { text: 'Cancelar', style: 'cancel' },
    ]);
  };

  const subirImagen = async (uri) => {
    setSubiendoFoto(true);
    try {
      const username = userProfile?.username || user.email.split('@')[0];
      await fotosService.uploadFoto(id, uri, user.uid, username);
      await cargarFotos();
      // Increment photo counter for logros
      import('../services/userService').then(({ userService }) =>
        userService.updateProfile(user.uid, { numFotos: (userProfile?.numFotos || 0) + 1 }).catch(() => {})
      );
    } catch (e) {
      Alert.alert('Error', 'No se pudo subir la foto. Inténtalo de nuevo.');
      console.warn('Error subiendo foto:', e);
    } finally {
      setSubiendoFoto(false);
    }
  };

  const compartirFiesta = async () => {
    const fechaStr = fecha
      ? new Date(fecha).toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })
      : '';
    try {
      await Share.share({
        message: `🎪 ${nombre}\n📅 ${fechaStr}\n📍 ${concejo}${orquesta ? `\n🎵 ${orquesta}` : ''}\n\n¡Descarga Folixa para descubrir más fiestas en Asturias! 🍺`,
        title: nombre,
      });
    } catch (error) {
      console.warn('Error compartiendo:', error);
    }
  };

  useEffect(() => {
    if (!id) return;
    let unsubscribe = () => {};

    const loadAttendance = async () => {
      // Check local storage
      const attendedStatus = await storageService.getItem(`attended_${id}`);
      setHasAttended(attendedStatus === 'true');

      // Listen to Firebase for real-time counter updates
      const fiestaRef = doc(db, 'fiestas', id);
      unsubscribe = onSnapshot(fiestaRef, (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data();
          setAsistentesCount(data.asistentes || 0);
        }
        setLoadingAttendance(false);
      });
    };

    loadAttendance();

    return () => unsubscribe();
  }, [id]);

  const toggleAttendance = async () => {
    if (loadingAttendance) return;
    
    // Optimistic UI update
    const newStatus = !hasAttended;
    setHasAttended(newStatus);
    setAsistentesCount(prev => newStatus ? prev + 1 : Math.max(0, prev - 1));

    try {
      const fiestaRef = doc(db, 'fiestas', id);
      if (newStatus) {
        await storageService.setItem(`attended_${id}`, 'true');
        await updateDoc(fiestaRef, { asistentes: increment(1) });
        if (user) await userService.updateAsistencia(user.uid, id, true);
      } else {
        await storageService.removeItem(`attended_${id}`);
        await updateDoc(fiestaRef, { asistentes: increment(-1) });
        if (user) await userService.updateAsistencia(user.uid, id, false);
      }
    } catch (error) {
      console.error("Error updating attendance:", error);
      Alert.alert("Error", "No se pudo actualizar tu asistencia.");
      // Revert optimistic update
      setHasAttended(!newStatus);
      setAsistentesCount(prev => !newStatus ? prev + 1 : Math.max(0, prev - 1));
    }
  };

  // --- CONFIGURACIÓN DE TRANSPORTE URBANO DINÁMICO ---
  const transporteUrbano = {
    "Oviedo": { nombre: "TUA Oviedo", color: "#d97706", url: "https://www.tua.es" },
    "Gijón": { nombre: "EMTUSA Gijón", color: "#dc2626", url: "https://www.emtusa.es/#lineas" },
    "Avilés": { nombre: "Bus Avilés", color: "#2563eb", url: "https://www.redtransporte.com/asturias/autobuses-aviles/" },
  };

  const infoUrbano = transporteUrbano[concejo];

  const fechaFormateada = fecha ? new Date(fecha).toLocaleDateString('es-ES', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
  }) : 'Fecha no disponible';

  const seleccionarAppMapa = () => {
    const lat = latitud;
    const lon = longitud;
    Alert.alert(
      "¿Con qué app quieres ir?",
      "Selecciona tu aplicación de mapas favorita",
      [
        { text: "Google Maps", onPress: () => Linking.openURL(`http://maps.google.com/?daddr=${lat},${lon}&travelmode=driving`) },
        { text: "Apple Maps", onPress: () => Linking.openURL(`http://maps.apple.com/?daddr=${lat},${lon}&dirflg=d`) },
        { text: "Waze", onPress: () => Linking.openURL(`https://www.waze.com/ul?ll=${lat},${lon}&navigate=yes`) },
        { text: "Cancelar", style: "cancel" }
      ]
    );
  };

  const manejarEliminacion = () => {
    Alert.alert("¿Eliminar fiesta?", `¿Borrar "${nombre}"?`, [
      { text: "Cancelar", style: "cancel" },
      { 
        text: "Eliminar", style: "destructive", 
        onPress: async () => {
          setCargandoEliminar(true);
          try {
            await deleteDoc(doc(db, "fiestas", id));
            router.replace('/mapa');
          } catch (error) { Alert.alert("Error", "No se pudo eliminar."); }
          setCargandoEliminar(false);
        }
      }
    ]);
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: isDark ? '#121212' : '#f4f4f4' }}>
      <Stack.Screen
        options={{
          title: nombre || "Detalles",
          headerStyle: { backgroundColor: isDark ? '#1e1e1e' : undefined },
          headerTintColor: isDark ? '#f1f1f1' : undefined,
          headerLeft: () => (
            <TouchableOpacity onPress={() => router.back()} style={{ paddingLeft: 10 }}>
              <Text style={{ fontSize: 24, color: isDark ? '#f1f1f1' : '#333' }}>← Atrás</Text>
            </TouchableOpacity>
          ),
          headerRight: () => (
            <TouchableOpacity
              onPress={handleToggleFavorite}
              style={{ paddingRight: 15 }}
              disabled={loadingFavorite}
            >
              <Text style={{ fontSize: 28, color: isDark ? '#f1f1f1' : '#333' }}>
                {loadingFavorite ? '...' : isFavorite ? '❤️' : '♡'}
              </Text>
            </TouchableOpacity>
          )
        }} 
      />
      <ScrollView style={styles.container}>

        {/* CARTEL + INFO FIJA */}
        <View style={[styles.infoCard, isDark && styles.infoCardDark]}>
          {imagen && (
            <TouchableOpacity activeOpacity={0.8} onPress={() => setModalVisible(true)}>
              <View style={styles.contenedorCartelPequeño}>
                {!imagenCargada && (
                  <View style={[styles.cartel, styles.placeholderImagen]}>
                    <Text style={styles.textoPlaceholder}>⛺</Text>
                  </View>
                )}
                <Image
                  source={{ uri: imagen }}
                  style={[styles.cartel, !imagenCargada && { position: 'absolute', opacity: 0 }]}
                  resizeMode="cover"
                  onLoad={() => setImagenCargada(true)}
                />
                <View style={styles.etiquetaAmpliar}>
                  <Text style={styles.textoAmpliar}>🔍 Ver cartel completo</Text>
                </View>
              </View>
            </TouchableOpacity>
          )}

        </View>

        {/* TABS */}
        <View style={[styles.tabBar, isDark && styles.tabBarDark]}>
          <TouchableOpacity
            style={[styles.tabBtn, tabDetalle === 'info' && { borderBottomColor: primaryColor, borderBottomWidth: 2.5 }]}
            onPress={() => setTabDetalle('info')}
          >
            <Text style={[styles.tabTxt, isDark && styles.tabTxtDark, tabDetalle === 'info' && { color: primaryColor, fontWeight: 'bold' }]}>
              ℹ️ Info
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tabBtn, tabDetalle === 'fotos' && { borderBottomColor: primaryColor, borderBottomWidth: 2.5 }]}
            onPress={() => setTabDetalle('fotos')}
          >
            <Text style={[styles.tabTxt, isDark && styles.tabTxtDark, tabDetalle === 'fotos' && { color: primaryColor, fontWeight: 'bold' }]}>
              📸 Fotos {fotos.length > 0 && `(${fotos.length})`}
            </Text>
          </TouchableOpacity>
        </View>

        {/* CONTENIDO SEGÚN TAB */}
        {tabDetalle === 'info' ? (
          <View style={[styles.tabContent, isDark && styles.tabContentDark]}>
            <Text style={styles.label}>📅 Fecha</Text>
            <Text style={[styles.value, isDark && styles.valueDark]}>{fechaFormateada}</Text>

            {weather && (
              <View style={[styles.weatherCard, isDark && styles.weatherCardDark]}>
                <Text style={styles.weatherEmoji}>{weather.emoji}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.weatherDesc, isDark && styles.valueDark]}>{weather.desc}</Text>
                  <Text style={styles.weatherTemp}>{weather.minTemp}° – {weather.maxTemp}°C</Text>
                </View>
                {weather.precipitation > 0 && (
                  <View style={styles.weatherRainBadge}>
                    <Text style={styles.weatherRainTxt}>💧 {weather.precipitation} mm</Text>
                  </View>
                )}
              </View>
            )}

            <Text style={styles.label}>🎪 Lugar</Text>
            <Text style={[styles.value, isDark && styles.valueDark]}>{nombre} ({concejo})</Text>
            <Text style={styles.label}>🎵 Música</Text>
            <Text style={[styles.value, isDark && styles.valueDark]}>{orquesta || 'Por confirmar'}</Text>

            <View style={styles.asistenciaContainer}>
              <TouchableOpacity
                style={[styles.btnAsistir, hasAttended && styles.btnAsistirActivo]}
                onPress={toggleAttendance}
                disabled={loadingAttendance}
              >
                <Text style={[styles.textoBtnAsistir, hasAttended && styles.textoBtnAsistirActivo]}>
                  {hasAttended ? '👋 ¡Voy a ir!' : '🤚 Asistiré'}
                </Text>
              </TouchableOpacity>
              <View style={styles.contadorContainer}>
                <Text style={styles.emojiContador}>👥</Text>
                <Text style={styles.textoContador}>
                  {asistentesCount} {asistentesCount === 1 ? 'persona asistirá' : 'personas asistirán'}
                </Text>
              </View>
            </View>

            <Text style={styles.labelRuta}>¿CÓMO LLEGAMOS A LA FOLIXA?</Text>
            <View style={styles.gridTransporte}>
              <TouchableOpacity style={[styles.btnOpcion, styles.btnCoche]} onPress={seleccionarAppMapa}>
                <Text style={styles.emoji}>🚗</Text>
                <Text style={styles.btnTexto}>Elegir GPS</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.btnOpcion, styles.btnAlsa]} onPress={() => Linking.openURL('https://www.alsa.es')}>
                <Text style={styles.emoji}>🚌</Text>
                <Text style={styles.btnTexto}>Alsa</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.btnOpcion, styles.btnRenfe]} onPress={() => Linking.openURL('https://www.renfe.com/es/es/cercanias/cercanias-asturias')}>
                <Text style={styles.emoji}>🚆</Text>
                <Text style={styles.btnTexto}>Cercanías</Text>
              </TouchableOpacity>
              {esVersity === 'true' && (
                <TouchableOpacity style={[styles.btnOpcion, styles.btnVersity]} onPress={() => Linking.openURL(linkVersity)}>
                  <Text style={styles.emoji}>🎒</Text>
                  <Text style={styles.btnTexto}>Versity</Text>
                </TouchableOpacity>
              )}
              {infoUrbano && (
                <TouchableOpacity style={[styles.btnOpcion, { backgroundColor: infoUrbano.color }]} onPress={() => Linking.openURL(infoUrbano.url)}>
                  <Text style={styles.emoji}>🏙️</Text>
                  <Text style={styles.btnTexto}>{infoUrbano.nombre}</Text>
                </TouchableOpacity>
              )}
            </View>

            <TouchableOpacity style={styles.btnCompartir} onPress={compartirFiesta}>
              <Text style={styles.btnTextoCompartir}>📤 COMPARTIR FIESTA</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.btnEditar} onPress={() => router.push({ pathname: '/editar', params: params })}>
              <Text style={styles.btnTextoEditar}>📝 EDITAR FIESTA</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.botonEliminar} onPress={manejarEliminacion} disabled={cargandoEliminar}>
              {cargandoEliminar ? <ActivityIndicator color="#666" /> : <Text style={styles.btnTextEliminar}>Eliminar esta fiesta</Text>}
            </TouchableOpacity>
          </View>
        ) : (
          <View style={[styles.tabContent, isDark && styles.tabContentDark]}>
            <View style={styles.galeriaHeader}>
              <Text style={[styles.galeriaTitle, isDark && { color: '#f1f1f1' }]}>Fotos de la folixa</Text>
              <TouchableOpacity
                style={[styles.btnAnadirFoto, { backgroundColor: primaryColor }]}
                onPress={handleSubirFoto}
                disabled={subiendoFoto}
              >
                {subiendoFoto
                  ? <ActivityIndicator color={textColor} size="small" />
                  : <Text style={[styles.btnAnadirFotoTxt, { color: textColor }]}>+ Añadir</Text>
                }
              </TouchableOpacity>
            </View>

            {fotos.length === 0 && !subiendoFoto ? (
              <View style={styles.galeriaVacia}>
                <Text style={styles.galeriaVaciaEmoji}>📷</Text>
                <Text style={[styles.galeriaVaciaTxt, isDark && { color: '#aaa' }]}>
                  Sé el primero en subir una foto
                </Text>
              </View>
            ) : (
              <FlatList
                data={fotos}
                keyExtractor={item => item.id}
                numColumns={3}
                scrollEnabled={false}
                renderItem={({ item }) => (
                  <TouchableOpacity onPress={() => setFotoModal(item)} style={styles.fotoItem}>
                    <Image source={{ uri: item.imageUrl }} style={styles.fotoThumb} />
                  </TouchableOpacity>
                )}
                style={{ marginTop: 4 }}
              />
            )}
          </View>
        )}
      </ScrollView>

      {/* MODAL FOTO DE USUARIO */}
      <Modal visible={!!fotoModal} transparent animationType="fade" onRequestClose={() => setFotoModal(null)}>
        <View style={styles.modalFondo}>
          <TouchableOpacity style={styles.botonCerrarModal} onPress={() => setFotoModal(null)}
            hitSlop={{ top: 20, bottom: 20, left: 20, right: 20 }}>
            <Text style={styles.textoCerrar}>❌</Text>
          </TouchableOpacity>
          {fotoModal && (
            <View style={{ alignItems: 'center', width: '100%' }}>
              <Image source={{ uri: fotoModal.imageUrl }} style={styles.cartelGigante} resizeMode="contain" />
              <Text style={{ color: 'white', marginTop: 10, fontWeight: 'bold', fontSize: 15 }}>
                📸 {fotoModal.username}
              </Text>
            </View>
          )}
        </View>
      </Modal>

      <Modal visible={modalVisible} transparent={true} animationType="fade" onRequestClose={() => setModalVisible(false)}>
        <View style={styles.modalFondo}>
          <TouchableOpacity 
            style={styles.botonCerrarModal} 
            onPress={() => setModalVisible(false)}
            hitSlop={{ top: 20, bottom: 20, left: 20, right: 20 }}
          >
            <Text style={styles.textoCerrar}>❌</Text>
            <Text style={styles.textoBotonCerrar}>Cerrar</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.areaZoomAtrás} 
            onPress={() => setModalVisible(false)}
            activeOpacity={1}
          >
            <Image source={{ uri: imagen }} style={styles.cartelGigante} resizeMode="contain" />
          </TouchableOpacity>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  infoCard: { backgroundColor: 'white', margin: 15, borderRadius: 20, overflow: 'hidden', elevation: 5 },
  infoCardDark: { backgroundColor: '#1e1e1e' },
  valueDark: { color: '#f1f1f1' },
  contenedorCartelPequeño: { position: 'relative' },
  cartel: { width: '100%', height: 300 },
  placeholderImagen: { backgroundColor: '#e2e8f0', justifyContent: 'center', alignItems: 'center' },
  textoPlaceholder: { fontSize: 60, opacity: 0.3 },
  etiquetaAmpliar: { position: 'absolute', bottom: 10, right: 10, backgroundColor: 'rgba(0,0,0,0.6)', padding: 8, borderRadius: 10 },
  textoAmpliar: { color: 'white', fontSize: 12, fontWeight: 'bold' },
  textoContainer: { padding: 20 },
  label: { fontSize: 12, color: '#94a3b8', fontWeight: 'bold', marginTop: 15, textTransform: 'uppercase' },
  value: { fontSize: 18, fontWeight: 'bold', color: '#1e293b', marginTop: 2 },
  labelRuta: { fontSize: 14, fontWeight: '900', marginTop: 30, textAlign: 'center', color: '#166534', letterSpacing: 1 },
  asistenciaContainer: { flexDirection: 'row', alignItems: 'center', marginTop: 25, backgroundColor: '#f8fafc', padding: 15, borderRadius: 15, borderWidth: 1, borderColor: '#e2e8f0' },
  btnAsistir: { backgroundColor: 'white', paddingHorizontal: 20, paddingVertical: 12, borderRadius: 12, borderWidth: 2, borderColor: '#3b82f6', elevation: 2, shadowColor: '#3b82f6', shadowOpacity: 0.2, shadowRadius: 3, shadowOffset: {width:0, height:2} },
  btnAsistirActivo: { backgroundColor: '#3b82f6' },
  textoBtnAsistir: { color: '#3b82f6', fontWeight: 'bold', fontSize: 16 },
  textoBtnAsistirActivo: { color: 'white' },
  contadorContainer: { marginLeft: 15, flexDirection: 'row', alignItems: 'center', flex: 1 },
  emojiContador: { fontSize: 20, marginRight: 5 },
  textoContador: { color: '#475569', fontSize: 14, fontWeight: 'bold', flexShrink: 1 },
  gridTransporte: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', marginTop: 15, gap: 10 },
  btnOpcion: { width: '48%', padding: 15, borderRadius: 15, alignItems: 'center', marginBottom: 10, elevation: 3 },
  btnCoche: { backgroundColor: '#166534' },
  btnAlsa: { backgroundColor: '#0284c7' },
  btnRenfe: { backgroundColor: '#5c2c84' }, 
  btnVersity: { backgroundColor: '#f97316' }, 
  btnTexto: { color: 'white', fontWeight: 'bold', marginTop: 5, fontSize: 12 },
  emoji: { fontSize: 24 },
  weatherCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: '#f0f9ff', borderRadius: 14, padding: 14,
    marginTop: 12, borderWidth: 1, borderColor: '#bae6fd',
  },
  weatherCardDark: { backgroundColor: '#0c2233', borderColor: '#1e4a6e' },
  weatherEmoji: { fontSize: 34 },
  weatherDesc: { fontSize: 15, fontWeight: '600', color: '#1e293b' },
  weatherTemp: { fontSize: 13, color: '#64748b', marginTop: 2 },
  weatherRainBadge: { backgroundColor: '#dbeafe', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10 },
  weatherRainTxt: { fontSize: 12, color: '#1d4ed8', fontWeight: '600' },
  btnCompartir: { backgroundColor: '#dbeafe', padding: 15, borderRadius: 15, alignItems: 'center', marginTop: 20 },
  btnTextoCompartir: { color: '#1d4ed8', fontWeight: 'bold' },
  btnEditar: { backgroundColor: '#e2e8f0', padding: 15, borderRadius: 15, alignItems: 'center', marginTop: 12 },
  btnTextoEditar: { color: '#475569', fontWeight: 'bold' },
  btnRecordatorio: { backgroundColor: '#FCD34D', padding: 15, borderRadius: 15, alignItems: 'center', marginTop: 12 },
  btnTextoRecordatorio: { color: '#744210', fontWeight: 'bold' },
  botonEliminar: { marginTop: 30, alignItems: 'center', padding: 10 },
  btnTextEliminar: { color: '#94a3b8', fontSize: 13, textDecorationLine: 'underline' },
  modalFondo: { flex: 1, backgroundColor: 'rgba(0,0,0,0.95)', justifyContent: 'center', alignItems: 'center' },
  areaZoomAtrás: { flex: 1, justifyContent: 'center', alignItems: 'center', width: '100%' },
  cartelGigante: { width: '100%', height: '85%' },
  botonCerrarModal: { position: 'absolute', top: 40, right: 20, backgroundColor: 'rgba(239, 68, 68, 0.9)', padding: 15, borderRadius: 50, zIndex: 100, minWidth: 60, height: 60, justifyContent: 'center', alignItems: 'center', elevation: 10 },
  textoCerrar: { color: 'white', fontWeight: 'bold', fontSize: 24, textAlign: 'center' },
  textoBotonCerrar: { color: 'white', fontWeight: 'bold', fontSize: 10, marginTop: 2, textAlign: 'center' },

  // Tabs
  tabBar: {
    flexDirection: 'row', backgroundColor: 'white',
    borderBottomWidth: 1, borderBottomColor: '#e5e5e5',
    marginTop: 10,
  },
  tabBarDark: { backgroundColor: '#1e1e1e', borderBottomColor: '#333' },
  tabBtn: { flex: 1, paddingVertical: 13, alignItems: 'center' },
  tabTxt: { fontSize: 14, fontWeight: '500', color: '#666' },
  tabTxtDark: { color: '#aaa' },
  tabContent: {
    backgroundColor: 'white', padding: 16, marginBottom: 30,
  },
  tabContentDark: { backgroundColor: '#1e1e1e' },

  // Galería
  galeriaHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  galeriaTitle: { fontSize: 16, fontWeight: 'bold', color: '#1e293b' },
  btnAnadirFoto: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 10 },
  btnAnadirFotoTxt: { fontWeight: 'bold', fontSize: 13 },
  galeriaVacia: { alignItems: 'center', paddingVertical: 40 },
  galeriaVaciaEmoji: { fontSize: 48, marginBottom: 10 },
  galeriaVaciaTxt: { color: '#94a3b8', fontSize: 15, textAlign: 'center' },
  fotoItem: { flex: 1/3, aspectRatio: 1, padding: 1.5 },
  fotoThumb: { flex: 1, borderRadius: 4 },
});