import * as ImageManipulator from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { deleteDoc, doc, getDoc, increment, onSnapshot, updateDoc } from 'firebase/firestore';
import ViewShot from 'react-native-view-shot';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Image, Linking, Modal, ScrollView, Share, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import ImageModal from '../components/ImageModal';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../contexts/AuthContext';
import { useConfig } from '../contexts/ConfigContext';
import { db } from '../firebaseConfig';
import { useFavorite } from '../hooks/useFavorite';
import { fotosService } from '../services/fotosService';
import { weatherService } from '../services/weatherService';
import { notificationService } from '../services/notificationService';
import * as Sharing from 'expo-sharing';
import { analyticsService } from '../services/analyticsService';
import { ratingService } from '../services/ratingService';
import { storageService } from '../services/storageService';
import { userService } from '../services/userService';

export default function PantallaDetalle() {
  const router = useRouter();
  const rawParams = useLocalSearchParams();
  const [fiestaData, setFiestaData] = useState(rawParams);
  const { id, nombre, concejo, orquesta, dj, imagen, latitud, longitud, fecha, fechaFin, diasJson, linkVersity, esVersity, linkEntradas } = fiestaData;
  const dias = (() => { try { return diasJson ? JSON.parse(diasJson) : null; } catch { return null; } })();
  const shareCardRef = useRef(null);
  const [modalTarjeta, setModalTarjeta] = useState(false);
  const [capturando, setCapturando] = useState(false);
  
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
  const [modalAsistentes, setModalAsistentes] = useState(false);
  const [asistentes, setAsistentes] = useState([]);
  const [cargandoAsistentes, setCargandoAsistentes] = useState(false);

  // Valoraciones
  const [miValoracion, setMiValoracion] = useState(null);
  const [valoracionMedia, setValoracionMedia] = useState(null);
  const [numValoraciones, setNumValoraciones] = useState(0);
  const [guardandoValoracion, setGuardandoValoracion] = useState(false);
  
  // Hook para favoritos
  const { isFavorite, toggleFavorite, loading: loadingFavorite } = useFavorite(id);
  const { theme, primaryColor, textColor } = useConfig();
  const isDark = theme === 'dark';
  const esAdmin = userProfile?.isAdmin === true;

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

  // Deep link: si solo llega el id (desde notificación o URL externa), cargamos de Firestore
  useEffect(() => {
    if (!id || nombre) return;
    getDoc(doc(db, 'fiestas', id)).then(snap => {
      if (snap.exists()) setFiestaData({ id: snap.id, ...snap.data() });
    }).catch(() => {});
  }, [id]);

  useEffect(() => {
    if (!id) return;
    updateDoc(doc(db, 'fiestas', id), { vistas: increment(1) }).catch(() => {});
    analyticsService.fiestaView(id, nombre);
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

  const confirmarBorrarFoto = (foto) => {
    Alert.alert('¿Eliminar foto?', 'Esta acción no se puede deshacer.', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar', style: 'destructive',
        onPress: async () => {
          try {
            await fotosService.deleteFoto(id, foto.id, foto.storagePath);
            setFotos(prev => prev.filter(f => f.id !== foto.id));
            if (fotoModal?.id === foto.id) setFotoModal(null);
          } catch {
            Alert.alert('Error', 'No se pudo eliminar la foto.');
          }
        },
      },
    ]);
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
      const compressed = await ImageManipulator.manipulateAsync(
        uri,
        [{ resize: { width: 1080 } }],
        { compress: 0.75, format: ImageManipulator.SaveFormat.JPEG }
      );
      const username = userProfile?.username || user.email.split('@')[0];
      await fotosService.uploadFoto(id, compressed.uri, user.uid, username);
      await cargarFotos();
      userService.updateProfile(user.uid, { numFotos: (userProfile?.numFotos || 0) + 1 }).catch(() => {});
    } catch (e) {
      Alert.alert('Error', 'No se pudo subir la foto. Inténtalo de nuevo.');
      console.warn('Error subiendo foto:', e);
    } finally {
      setSubiendoFoto(false);
    }
  };

  const buildTextoCompartir = () => {
    const fechaStr = fecha
      ? new Date(fecha).toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
      : '';
    return `🎪 ${nombre}\n📅 ${fechaStr}\n📍 ${concejo}${orquesta ? `\n🎵 ${orquesta}` : ''}${dj ? `\n🎧 ${dj}` : ''}\n\n¡Descarga Folixa para descubrir más fiestas en Asturias! 🍺`;
  };

  const compartirImagen = async () => {
    setCapturando(true);
    try {
      const uri = await shareCardRef.current.capture();
      const disponible = await Sharing.isAvailableAsync();
      if (disponible) {
        await Sharing.shareAsync(uri, { mimeType: 'image/png', dialogTitle: 'Compartir fiesta' });
      } else {
        await Share.share({ url: uri });
      }
      analyticsService.fiestaShare(id);
    } catch (e) {
      console.warn('Error compartiendo imagen:', e);
    } finally {
      setCapturando(false);
    }
  };

  const compartirTexto = async () => {
    try {
      await Share.share({ message: buildTextoCompartir(), title: nombre });
      analyticsService.fiestaShare(id);
    } catch (e) {
      console.warn('Error compartiendo texto:', e);
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
          const n = data.numValoraciones || 0;
          setNumValoraciones(n);
          setValoracionMedia(n > 0 ? (data.valoracionTotal || 0) / n : null);
        }
        setLoadingAttendance(false);
      });

      if (user) {
        ratingService.getUserRating(id, user.uid).then(setMiValoracion);
      }
    };

    loadAttendance();

    return () => unsubscribe();
  }, [id]);

  const toggleAttendance = async () => {
    if (loadingAttendance) return;

    const newStatus = !hasAttended;
    setHasAttended(newStatus);
    setAsistentesCount(prev => newStatus ? prev + 1 : Math.max(0, prev - 1));

    try {
      const fiestaRef = doc(db, 'fiestas', id);
      if (newStatus) {
        await storageService.setItem(`attended_${id}`, 'true');
        await updateDoc(fiestaRef, { asistentes: increment(1) });
        if (user) await userService.updateAsistencia(user.uid, id, true);
        analyticsService.fiestaAttend(id);
        try {
          const notifIds = await notificationService.scheduleAllRemindersForFiesta?.({ id, nombre, fecha, concejo });
          if (notifIds?.length) await storageService.setItem(`reminder_attended_${id}`, JSON.stringify(notifIds));
        } catch (e) {}
        try {
          const listStr = await storageService.getItem('@folixa_mis_asistencias');
          const lista = listStr ? JSON.parse(listStr) : [];
          if (!lista.includes(id)) lista.push(id);
          await storageService.setItem('@folixa_mis_asistencias', JSON.stringify(lista));
        } catch (e) {}
      } else {
        await storageService.removeItem(`attended_${id}`);
        await updateDoc(fiestaRef, { asistentes: increment(-1) });
        if (user) await userService.updateAsistencia(user.uid, id, false);
        try {
          const stored = await storageService.getItem(`reminder_attended_${id}`);
          if (stored) {
            await notificationService.cancelAllRemindersForFiesta?.(JSON.parse(stored));
            await storageService.removeItem(`reminder_attended_${id}`);
          }
        } catch (e) {}
        try {
          const listStr = await storageService.getItem('@folixa_mis_asistencias');
          const lista = listStr ? JSON.parse(listStr) : [];
          const idx = lista.indexOf(id);
          if (idx !== -1) lista.splice(idx, 1);
          await storageService.setItem('@folixa_mis_asistencias', JSON.stringify(lista));
        } catch (e) {}
      }
    } catch (error) {
      console.error("Error updating attendance:", error);
      Alert.alert("Error", "No se pudo actualizar tu asistencia.");
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

  const fechaFormateada = (() => {
    if (!fecha) return 'Fecha no disponible';
    const opts = { day: 'numeric', month: 'long', year: 'numeric' };
    const inicio = new Date(fecha).toLocaleDateString('es-ES', opts);
    if (fechaFin) {
      const fin = new Date(fechaFin).toLocaleDateString('es-ES', opts);
      return `${inicio} — ${fin}`;
    }
    return new Date(fecha).toLocaleDateString('es-ES', { weekday: 'long', ...opts });
  })();

  const seleccionarAppMapa = () => {
    const lat = latitud;
    const lon = longitud;
    Alert.alert(
      "¿Con qué app quieres ir?",
      "Selecciona tu aplicación de mapas favorita",
      [
        { text: "Google Maps", onPress: () => Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${lat},${lon}&travelmode=driving`) },
        { text: "Apple Maps", onPress: () => Linking.openURL(`https://maps.apple.com/?daddr=${lat},${lon}&dirflg=d`) },
        { text: "Waze", onPress: () => Linking.openURL(`https://www.waze.com/ul?ll=${lat},${lon}&navigate=yes`) },
        { text: "Cancelar", style: "cancel" }
      ]
    );
  };

  const votar = async (valor) => {
    if (!user || guardandoValoracion) return;
    setGuardandoValoracion(true);
    const prev = miValoracion;
    setMiValoracion(valor);
    try {
      await ratingService.setRating(id, user.uid, valor, prev);
      analyticsService.fiestaRate(id, valor);
    } catch (e) {
      console.error('❌ Error guardando valoración:', e?.code, e?.message);
      setMiValoracion(prev);
    } finally {
      setGuardandoValoracion(false);
    }
  };

  const verAsistentes = async () => {
    if (asistentesCount === 0) return;
    setModalAsistentes(true);
    setCargandoAsistentes(true);
    try {
      const lista = await userService.getAsistentes(id);
      setAsistentes(lista);
    } catch (e) {
      console.warn('Error cargando asistentes:', e);
    } finally {
      setCargandoAsistentes(false);
    }
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
            {dias && dias.length > 0 ? (
              <View style={styles.programaContainer}>
                <Text style={styles.label}>🗓️ Programa</Text>
                {dias.map(dia => (
                  <View key={dia.fecha} style={[styles.programaDia, isDark && styles.programaDiaDark]}>
                    <Text style={[styles.programaFecha, { color: isDark ? '#86efac' : '#166534' }]}>
                      {new Date(dia.fecha).toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}
                    </Text>
                    {dia.orquesta ? <Text style={[styles.programaLinea, isDark && styles.valueDark]}>🎵 {dia.orquesta}</Text> : null}
                    {dia.dj ? <Text style={[styles.programaLinea, isDark && styles.valueDark]}>🎧 {dia.dj}</Text> : null}
                    {!dia.orquesta && !dia.dj ? <Text style={[styles.programaLinea, { color: '#94a3b8' }]}>Por confirmar</Text> : null}
                  </View>
                ))}
              </View>
            ) : (
              <>
                <Text style={styles.label}>🎵 Orquesta</Text>
                <Text style={[styles.value, isDark && styles.valueDark]}>{orquesta || 'Por confirmar'}</Text>
                {dj ? (
                  <>
                    <Text style={styles.label}>🎧 DJ</Text>
                    <Text style={[styles.value, isDark && styles.valueDark]}>{dj}</Text>
                  </>
                ) : null}
              </>
            )}

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
              <TouchableOpacity
                style={styles.contadorContainer}
                onPress={verAsistentes}
                disabled={asistentesCount === 0}
                activeOpacity={asistentesCount > 0 ? 0.6 : 1}
              >
                <Text style={styles.emojiContador}>👥</Text>
                <Text style={styles.textoContador}>
                  {asistentesCount} {asistentesCount === 1 ? 'persona asistirá' : 'personas asistirán'}
                </Text>
                {asistentesCount > 0 && (
                  <Text style={{ color: '#94a3b8', fontSize: 13, marginLeft: 4 }}>Ver ›</Text>
                )}
              </TouchableOpacity>
            </View>

            <View style={[styles.valoracionCard, isDark && styles.valoracionCardDark]}>
              <View style={styles.valoracionHeader}>
                <Text style={[styles.valoracionTitulo, isDark && styles.valueDark]}>
                  ⭐ Valoración
                </Text>
                {valoracionMedia !== null && (
                  <Text style={styles.valoracionMedia}>
                    {valoracionMedia.toFixed(1)} <Text style={styles.valoracionCount}>({numValoraciones})</Text>
                  </Text>
                )}
              </View>
              {user ? (
                <View style={styles.estrellas}>
                  {[1, 2, 3, 4, 5].map(n => (
                    <TouchableOpacity key={n} onPress={() => votar(n)} disabled={guardandoValoracion} activeOpacity={0.7}>
                      <Text style={[styles.estrella, miValoracion >= n && styles.estrellaActiva]}>
                        {miValoracion >= n ? '★' : '☆'}
                      </Text>
                    </TouchableOpacity>
                  ))}
                  {miValoracion && (
                    <Text style={styles.valoracionTuNota}>Tu nota: {miValoracion}/5</Text>
                  )}
                </View>
              ) : (
                <Text style={[styles.valoracionLogin, isDark && { color: '#94a3b8' }]}>
                  Inicia sesión para valorar
                </Text>
              )}
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

            {linkEntradas ? (
              <TouchableOpacity style={styles.btnEntradas} onPress={() => Linking.openURL(linkEntradas)}>
                <Text style={styles.btnTextoEntradas}>🎟️ COMPRAR ENTRADAS</Text>
              </TouchableOpacity>
            ) : null}

            <TouchableOpacity style={styles.btnCompartir} onPress={() => setModalTarjeta(true)}>
              <Text style={styles.btnTextoCompartir}>📤 Compartir esta folixa</Text>
            </TouchableOpacity>
            {esAdmin && (
              <>
                <TouchableOpacity style={styles.btnEditar} onPress={() => router.push({ pathname: '/editar', params: fiestaData })}>
                  <Text style={styles.btnTextoEditar}>📝 EDITAR FIESTA</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.botonEliminar} onPress={manejarEliminacion} disabled={cargandoEliminar}>
                  {cargandoEliminar ? <ActivityIndicator color="#666" /> : <Text style={styles.btnTextEliminar}>Eliminar esta fiesta</Text>}
                </TouchableOpacity>
              </>
            )}
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
                renderItem={({ item }) => {
                  const puedeEliminar = item.uid === user?.uid || esAdmin;
                  return (
                    <View style={styles.fotoItem}>
                      <TouchableOpacity onPress={() => setFotoModal(item)} style={{ flex: 1 }}>
                        <Image source={{ uri: item.imageUrl }} style={styles.fotoThumb} />
                        <View style={styles.fotoUploaderOverlay}>
                          <Text style={styles.fotoUploaderTxt} numberOfLines={1}>
                            {item.username || '?'}
                          </Text>
                        </View>
                      </TouchableOpacity>
                      {puedeEliminar && (
                        <TouchableOpacity
                          style={styles.btnBorrarFoto}
                          onPress={() => confirmarBorrarFoto(item)}
                          hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                        >
                          <Text style={styles.btnBorrarFotoTxt}>✕</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  );
                }}
                style={{ marginTop: 4 }}
              />
            )}
          </View>
        )}
      </ScrollView>

      {/* MODAL VER ASISTENTES */}
      <Modal visible={modalAsistentes} transparent animationType="slide" onRequestClose={() => setModalAsistentes(false)}>
        <TouchableOpacity style={styles.modalAsistentesFondo} activeOpacity={1} onPress={() => setModalAsistentes(false)}>
          <View style={[styles.modalAsistentesContenido, isDark && styles.infoCardDark]} onStartShouldSetResponder={() => true}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <Text style={[styles.modalAsistentesTitulo, isDark && styles.valueDark]}>
                👥 Asistentes ({asistentesCount})
              </Text>
              <TouchableOpacity onPress={() => setModalAsistentes(false)} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
                <Text style={{ fontSize: 20, color: '#94a3b8' }}>✕</Text>
              </TouchableOpacity>
            </View>
            {cargandoAsistentes ? (
              <ActivityIndicator color={primaryColor} style={{ marginVertical: 24 }} />
            ) : asistentes.length === 0 ? (
              <Text style={{ color: '#94a3b8', textAlign: 'center', marginVertical: 24, fontSize: 15 }}>
                Nadie ha confirmado asistencia aún
              </Text>
            ) : (
              <ScrollView>
                {asistentes.map((a) => (
                  <View key={a.uid} style={styles.asistenteRow}>
                    <View style={[styles.asistenteAvatar, { backgroundColor: primaryColor }]}>
                      <Text style={{ color: 'white', fontWeight: 'bold', fontSize: 15 }}>
                        {(a.username || '?')[0].toUpperCase()}
                      </Text>
                    </View>
                    <Text style={[styles.asistenteNombre, isDark && styles.valueDark]}>
                      {a.username || 'Usuario'}
                    </Text>
                  </View>
                ))}
              </ScrollView>
            )}
          </View>
        </TouchableOpacity>
      </Modal>

      <ImageModal
        visible={!!fotoModal}
        onClose={() => setFotoModal(null)}
        imageUrl={fotoModal?.imageUrl}
        footer={fotoModal ? (
          <>
            <Text style={{ color: 'white', fontWeight: 'bold', fontSize: 15 }}>
              📸 {fotoModal.username}
            </Text>
            {(fotoModal.uid === user?.uid || esAdmin) && (
              <TouchableOpacity
                style={styles.btnBorrarFotoModal}
                onPress={() => confirmarBorrarFoto(fotoModal)}
              >
                <Text style={styles.btnBorrarFotoModalTxt}>🗑️ Eliminar foto</Text>
              </TouchableOpacity>
            )}
          </>
        ) : null}
      />

      <ImageModal
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        imageUrl={imagen}
      />

      {/* MODAL TARJETA VISUAL */}
      <Modal visible={modalTarjeta} transparent animationType="fade" onRequestClose={() => setModalTarjeta(false)}>
        <View style={styles.tarjetaFondo}>
          <ViewShot ref={shareCardRef} options={{ format: 'png', quality: 1 }}>
            <View style={styles.tarjetaCard}>
              <View style={styles.tarjetaHeader}>
                <Text style={styles.tarjetaApp}>🎪 Folixa</Text>
              </View>
              <Text style={styles.tarjetaNombre}>{nombre}</Text>
              <View style={styles.tarjetaSeparador} />
              <Text style={styles.tarjetaFecha}>
                📅 {fecha ? new Date(fecha).toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) : ''}
              </Text>
              <Text style={styles.tarjetaConcejo}>📍 {concejo}</Text>
              {orquesta ? <Text style={styles.tarjetaOrquesta}>🎵 {orquesta}</Text> : null}
              {dj ? <Text style={styles.tarjetaOrquesta}>🎧 {dj}</Text> : null}
              {valoracionMedia !== null && numValoraciones > 0 ? (
                <Text style={styles.tarjetaRating}>⭐ {valoracionMedia.toFixed(1)} ({numValoraciones} valoraciones)</Text>
              ) : null}
              <View style={styles.tarjetaFooter}>
                <Text style={styles.tarjetaFooterTxt}>Descarga Folixa — fiestas de Asturias</Text>
              </View>
            </View>
          </ViewShot>

          <View style={styles.tarjetaBtns}>
            <TouchableOpacity
              style={[styles.btnCapturar, capturando && { opacity: 0.6 }]}
              onPress={compartirImagen}
              disabled={capturando}
            >
              {capturando
                ? <ActivityIndicator color="white" />
                : (
                  <View>
                    <Text style={styles.btnCapturarTxt}>🖼️ Compartir imagen</Text>
                    <Text style={styles.btnCapturarSub}>Instagram Stories, WhatsApp, etc.</Text>
                  </View>
                )
              }
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.btnCompartirTextoModal}
              onPress={async () => { await compartirTexto(); setModalTarjeta(false); }}
            >
              <View>
                <Text style={styles.btnCompartirTextoModalTxt}>💬 Compartir texto</Text>
                <Text style={styles.btnCompartirTextoModalSub}>WhatsApp, SMS, email…</Text>
              </View>
            </TouchableOpacity>
            <TouchableOpacity style={styles.btnCerrarTarjeta} onPress={() => setModalTarjeta(false)}>
              <Text style={styles.btnCerrarTarjetaTxt}>Cancelar</Text>
            </TouchableOpacity>
          </View>
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
  programaContainer: { marginTop: 4 },
  programaDia: { backgroundColor: '#f0fdf4', borderRadius: 10, padding: 12, marginTop: 8, borderLeftWidth: 3, borderLeftColor: '#166534' },
  programaDiaDark: { backgroundColor: '#14532d' },
  programaFecha: { fontWeight: 'bold', fontSize: 13, marginBottom: 4, textTransform: 'capitalize' },
  programaLinea: { fontSize: 15, color: '#1e293b', marginTop: 2 },
  btnEntradas: {
    backgroundColor: '#7c3aed', padding: 16, borderRadius: 15,
    alignItems: 'center', marginTop: 20,
  },
  btnTextoEntradas: { color: 'white', fontWeight: 'bold', fontSize: 15, letterSpacing: 0.5 },
  label: { fontSize: 12, color: '#94a3b8', fontWeight: 'bold', marginTop: 15, textTransform: 'uppercase' },
  value: { fontSize: 18, fontWeight: 'bold', color: '#1e293b', marginTop: 2 },
  valoracionCard: {
    marginTop: 20, backgroundColor: '#f8fafc', borderRadius: 16,
    padding: 16, borderWidth: 1, borderColor: '#e2e8f0',
  },
  valoracionCardDark: { backgroundColor: '#1a2332', borderColor: '#2d3748' },
  valoracionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  valoracionTitulo: { fontSize: 14, fontWeight: '700', color: '#475569' },
  valoracionMedia: { fontSize: 18, fontWeight: 'bold', color: '#f59e0b' },
  valoracionCount: { fontSize: 12, color: '#94a3b8', fontWeight: 'normal' },
  estrellas: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  estrella: { fontSize: 32, color: '#d1d5db' },
  estrellaActiva: { color: '#f59e0b' },
  valoracionTuNota: { fontSize: 12, color: '#94a3b8', marginLeft: 8 },
  valoracionLogin: { fontSize: 13, color: '#94a3b8', fontStyle: 'italic' },
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
  btnCompartirTextoModal: {
    backgroundColor: 'rgba(255,255,255,0.12)', padding: 16,
    borderRadius: 14, alignItems: 'center',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)',
  },
  btnCompartirTextoModalTxt: { color: 'white', fontWeight: 'bold', fontSize: 15, textAlign: 'center' },
  btnCompartirTextoModalSub: { color: 'rgba(255,255,255,0.55)', fontSize: 12, textAlign: 'center', marginTop: 2 },

  tarjetaFondo: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  tarjetaCard: {
    backgroundColor: '#166534', borderRadius: 24, padding: 28, width: 320,
    shadowColor: '#000', shadowOpacity: 0.5, shadowRadius: 20, elevation: 20,
  },
  tarjetaHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  tarjetaApp: { color: 'rgba(255,255,255,0.9)', fontSize: 16, fontWeight: 'bold' },
  tarjetaNombre: { color: 'white', fontSize: 26, fontWeight: 'bold', lineHeight: 32, marginBottom: 16 },
  tarjetaSeparador: { height: 1, backgroundColor: 'rgba(255,255,255,0.25)', marginBottom: 16 },
  tarjetaFecha: { color: 'rgba(255,255,255,0.9)', fontSize: 15, marginBottom: 8, textTransform: 'capitalize' },
  tarjetaConcejo: { color: 'rgba(255,255,255,0.9)', fontSize: 15, marginBottom: 6 },
  tarjetaOrquesta: { color: 'rgba(255,255,255,0.85)', fontSize: 14, marginBottom: 6 },
  tarjetaRating: { color: '#fbbf24', fontSize: 14, fontWeight: '700', marginTop: 4 },
  tarjetaFooter: { marginTop: 20, paddingTop: 14, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.2)' },
  tarjetaFooterTxt: { color: 'rgba(255,255,255,0.6)', fontSize: 11, textAlign: 'center' },

  tarjetaBtns: { marginTop: 20, width: 320, gap: 10 },
  btnCapturar: { backgroundColor: '#166534', padding: 16, borderRadius: 14, alignItems: 'center' },
  btnCapturarTxt: { color: 'white', fontWeight: 'bold', fontSize: 16, textAlign: 'center' },
  btnCapturarSub: { color: 'rgba(255,255,255,0.65)', fontSize: 12, textAlign: 'center', marginTop: 2 },
  btnCerrarTarjeta: { backgroundColor: 'rgba(255,255,255,0.1)', padding: 14, borderRadius: 14, alignItems: 'center' },
  btnCerrarTarjetaTxt: { color: 'rgba(255,255,255,0.7)', fontWeight: '600' },

  btnCompartir: { backgroundColor: '#1d4ed8', padding: 16, borderRadius: 15, alignItems: 'center', marginTop: 20 },
  btnTextoCompartir: { color: 'white', fontWeight: 'bold', fontSize: 15 },
  btnEditar: { backgroundColor: '#e2e8f0', padding: 15, borderRadius: 15, alignItems: 'center', marginTop: 12 },
  btnTextoEditar: { color: '#475569', fontWeight: 'bold' },
  btnRecordatorio: { backgroundColor: '#FCD34D', padding: 15, borderRadius: 15, alignItems: 'center', marginTop: 12 },
  btnTextoRecordatorio: { color: '#744210', fontWeight: 'bold' },
  botonEliminar: { marginTop: 30, alignItems: 'center', padding: 10 },
  btnTextEliminar: { color: '#94a3b8', fontSize: 13, textDecorationLine: 'underline' },

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
  fotoUploaderOverlay: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: 'rgba(0,0,0,0.55)',
    paddingHorizontal: 4, paddingVertical: 3,
  },
  fotoUploaderTxt: { color: 'white', fontSize: 9, fontWeight: '600' },
  btnBorrarFoto: {
    position: 'absolute', top: 4, right: 4,
    backgroundColor: 'rgba(0,0,0,0.6)',
    width: 22, height: 22, borderRadius: 11,
    alignItems: 'center', justifyContent: 'center',
  },
  btnBorrarFotoTxt: { color: 'white', fontSize: 10, fontWeight: 'bold' },
  btnBorrarFotoModal: {
    marginTop: 16, backgroundColor: 'rgba(239,68,68,0.85)',
    paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12,
  },
  btnBorrarFotoModalTxt: { color: 'white', fontWeight: 'bold', fontSize: 15 },
  modalAsistentesFondo: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.45)' },
  modalAsistentesContenido: {
    backgroundColor: 'white', borderTopLeftRadius: 22, borderTopRightRadius: 22,
    padding: 24, maxHeight: '60%',
  },
  modalAsistentesTitulo: { fontSize: 17, fontWeight: 'bold', color: '#1e293b' },
  asistenteRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, gap: 14, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  asistenteAvatar: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  asistenteNombre: { fontSize: 15, fontWeight: '500', color: '#1e293b' },
});