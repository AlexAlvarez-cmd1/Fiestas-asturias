import DateTimePicker from '@react-native-community/datetimepicker';
import Slider from '@react-native-community/slider';
import * as Location from 'expo-location';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Modal, Platform, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import MapView, { Circle, Marker } from 'react-native-maps';
import { useConfig } from '../../contexts/ConfigContext';

// FIREBASE
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../../firebaseConfig';
import { favoritesService } from '../../services/favoritesService';

// NOTIFICACIONES
import { notificationService } from '../../services/notificationService';

// CACHÉ
import { cacheService } from '../../services/cacheService';

function calcularDistancia(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

export default function PantallaMapa() {
  const router = useRouter();
  const mapRef = useRef(null);
  const { emojiFiesta, primaryColor } = useConfig();
  
  const [listaDeFiestas, setListaDeFiestas] = useState([]);
  const [cargando, setCargando] = useState(true);
  
  const [gpsReal, setGpsReal] = useState({ lat: 43.3614, lon: -5.8593 }); 
  const [centroFiltro, setCentroFiltro] = useState({ lat: 43.3614, lon: -5.8593 }); 
  const [regionVista, setRegionVista] = useState(null); 

  const [mostrarBotonZona, setMostrarBotonZona] = useState(false);
  const [radioKm, setRadioKm] = useState(30);
  const [fechaInicio, setFechaInicio] = useState(null);
  const [fechaFin, setFechaFin] = useState(null);
  const [modoPicker, setModoPicker] = useState(null);
  const [busqueda, setBusqueda] = useState('');
  const [orquestaFiltro, setOrquestaFiltro] = useState('');
  const [modalFiltrosVisible, setModalFiltrosVisible] = useState(false);
  const [soloFavoritos, setSoloFavoritos] = useState(false);
  const [favoritosIds, setFavoritosIds] = useState([]);

  useFocusEffect(
    useCallback(() => {
      const inicializarApp = async () => {
        try {
          let { status } = await Location.requestForegroundPermissionsAsync();
          if (status === 'granted') {
            let location = await Location.getCurrentPositionAsync({});
            const miLoc = { lat: location.coords.latitude, lon: location.coords.longitude };
            setGpsReal(miLoc);
            setCentroFiltro(miLoc);
          }
        } catch (error) { console.warn("Error GPS:", error); }

        try {
          await notificationService.requestNotificationPermissions();
        } catch (error) {
          console.warn("Error notificaciones:", error);
        }

        // CACHÉ: Intentar leer caché primero
        const cachedFiestas = await cacheService.getCachedFiestas();
        if (cachedFiestas && cachedFiestas.length > 0) {
          setListaDeFiestas(cachedFiestas);
        }

        try {
          const querySnapshot = await getDocs(collection(db, "fiestas"));
          const fiestasDescargadas = [];
          querySnapshot.forEach((doc) => {
            fiestasDescargadas.push({ id: doc.id, ...doc.data() });
          });

          if (fiestasDescargadas.length > 0) {
            await cacheService.setCachedFiestas(fiestasDescargadas);
            setListaDeFiestas(fiestasDescargadas);
          }

          if (gpsReal && gpsReal.lat) {
            fiestasDescargadas.forEach((fiesta) => {
              if (fiesta.ubicacion) {
                const dist = calcularDistancia(
                  gpsReal.lat,
                  gpsReal.lon,
                  fiesta.ubicacion.latitude,
                  fiesta.ubicacion.longitude
                );
                if (dist <= 30) {
                  notificationService.notifyNewFiestaInZone(fiesta, dist);
                }
              }
            });
          }
        } catch (error) {
          console.warn("Error conectando con Firebase:", error);
        }

        try {
          const favs = await favoritesService.getFavorites();
          setFavoritosIds(favs || []);
        } catch (error) {
          console.warn("Error favs:", error);
        }

        setCargando(false);
      };
      inicializarApp();
    }, [])
  );

  const buscarEnEstaZona = () => {
    if (regionVista) {
      setCentroFiltro({ lat: regionVista.latitude, lon: regionVista.longitude });
      setMostrarBotonZona(false);
    }
  };

  const recentrarMapa = () => {
    if (gpsReal && mapRef.current) {
      setCentroFiltro(gpsReal); 
      setMostrarBotonZona(false);
      mapRef.current.animateToRegion({
        latitude: gpsReal.lat, longitude: gpsReal.lon,
        latitudeDelta: 0.05, longitudeDelta: 0.05,
      }, 1000);
    }
  };

  // --- LÓGICA DE FILTRADO DE FECHAS MEJORADA (INCLUSIVA) ---
  const fiestasFiltradas = listaDeFiestas.filter((fiesta) => {
    if (!fiesta.ubicacion || !fiesta.fecha) return false;

    // 1. Filtro de búsqueda por nombre
    if (busqueda.trim() !== '') {
      const nombre = fiesta.nombre.toLowerCase();
      const busquedaLower = busqueda.toLowerCase();
      if (!nombre.includes(busquedaLower)) return false;
    }

    // 2. Filtro por orquesta
    if (orquestaFiltro !== '') {
      if (!fiesta.orquesta || fiesta.orquesta.toLowerCase() !== orquestaFiltro.toLowerCase()) {
        return false;
      }
    }

    // Filtro Favoritos
    if (soloFavoritos) {
      if (!favoritosIds.includes(fiesta.id)) {
        return false;
      }
    }

    // 3. Filtro de distancia
    const dist = calcularDistancia(centroFiltro.lat, centroFiltro.lon, fiesta.ubicacion.latitude, fiesta.ubicacion.longitude);
    if (dist > radioKm) return false;

    // 4. Filtro de fechas (Normalizamos a medianoche para que sea inclusivo)
    const fFiesta = new Date(fiesta.fecha);
    fFiesta.setHours(0,0,0,0);

    const hoy = new Date();
    hoy.setHours(0,0,0,0);

    // Fecha de inicio (si no hay, usamos hoy)
    const inicio = fechaInicio ? new Date(fechaInicio) : hoy;
    inicio.setHours(0,0,0,0);

    if (fechaFin) {
      const fin = new Date(fechaFin);
      fin.setHours(23,59,59,999); // Fin del día para incluir el último día elegido
      return fFiesta >= inicio && fFiesta <= fin;
    }

    // Si no hay fecha de fin, mostramos todo lo que sea hoy o futuro respecto al inicio
    return fFiesta >= inicio;
  });

  if (cargando) {
    return (
      <View style={[styles.pantallaCarga, { backgroundColor: primaryColor }]}>
        <ActivityIndicator size="large" color="#F59E0B" />
        <Text style={styles.textoCarga}>Localizando folixas...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={[styles.panelControl, { backgroundColor: primaryColor }]}>
        <View style={styles.headerPanel}>
          <Text style={styles.textoLabel}>Radio: {Math.round(radioKm)} km</Text>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <TouchableOpacity
              style={[styles.btnLupa, soloFavoritos && styles.btnActivoFondo]}
              onPress={() => setSoloFavoritos(!soloFavoritos)}
            >
              <Text style={styles.textoLupa}>⭐</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.btnLupa}
              onPress={() => setModalFiltrosVisible(true)}
            >
              <Text style={styles.textoLupa}>🔍</Text>
            </TouchableOpacity>
          </View>
        </View>

        <Slider
          style={{width: '100%', height: 30}} minimumValue={5} maximumValue={100} value={radioKm}
          onValueChange={setRadioKm} minimumTrackTintColor="#F59E0B" thumbTintColor="#F59E0B"
        />

        <View style={styles.rowFechas}>
          <TouchableOpacity style={[styles.btnFecha, styles.btnFechaFlexible, modoPicker === 'inicio' && styles.btnActivo]} onPress={() => setModoPicker('inicio')}>
            <Text style={styles.lblFecha}>DESDE</Text>
            <Text style={styles.valFecha}>{fechaInicio ? fechaInicio.toLocaleDateString() : 'Hoy'}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.btnFecha, styles.btnFechaFlexible, modoPicker === 'fin' && styles.btnActivo]} onPress={() => setModoPicker('fin')}>
            <Text style={styles.lblFecha}>HASTA</Text>
            <Text style={styles.valFecha}>{fechaFin ? fechaFin.toLocaleDateString() : 'Siempre'}</Text>
          </TouchableOpacity>
          {(fechaInicio || fechaFin) && (
            <TouchableOpacity style={styles.btnLimpiar} onPress={() => { setFechaInicio(null); setFechaFin(null); setModoPicker(null); }}>
              <Text style={styles.lblLimpiar}>✕</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {modoPicker && (
        <View style={styles.modalCalendario}>
           <DateTimePicker
            value={modoPicker === 'inicio' ? (fechaInicio || new Date()) : (fechaFin || new Date())}
            mode="date" display={Platform.OS === 'ios' ? 'inline' : 'default'}
            onChange={(event, date) => {
              if (date) {
                if (modoPicker === 'inicio') setFechaInicio(date);
                else setFechaFin(date);
              }
              setModoPicker(null);
            }}
          />
        </View>
      )}

      {/* MODAL DE FILTROS CON LUPA */}
      <Modal
        visible={modalFiltrosVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setModalFiltrosVisible(false)}
      >
        <View style={styles.modalFiltrosFondo}>
          <View style={styles.modalFiltrosContenido}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitulo}>🔍 Filtros</Text>
              <TouchableOpacity onPress={() => setModalFiltrosVisible(false)}>
                <Text style={styles.btnCerrarModal}>✕</Text>
              </TouchableOpacity>
            </View>

            <TextInput
              style={styles.inputModal}
              placeholder="Buscar por nombre de fiesta..."
              value={busqueda}
              onChangeText={setBusqueda}
              placeholderTextColor="#999"
            />

            <TextInput
              style={styles.inputModal}
              placeholder="Filtrar por orquesta/banda..."
              value={orquestaFiltro}
              onChangeText={setOrquestaFiltro}
              placeholderTextColor="#999"
            />

            <TouchableOpacity
              style={styles.btnLimpiarModal}
              onPress={() => { setBusqueda(''); setOrquestaFiltro(''); }}
            >
              <Text style={styles.textoLimpiarModal}>🔄 Limpiar filtros</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.btnCerrarFiltros}
              onPress={() => setModalFiltrosVisible(false)}
            >
              <Text style={styles.textoCerrarFiltros}>Cerrar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* BOTÓN BUSCAR EN ESTA ZONA (Al fondo) */}
      {mostrarBotonZona && (
        <TouchableOpacity style={styles.btnBuscarZona} onPress={buscarEnEstaZona}>
          <Text style={styles.textoBusqueda}>🔍 Buscar en esta zona</Text>
        </TouchableOpacity>
      )}

      <MapView 
        ref={mapRef}
        style={styles.map} 
        initialRegion={{ latitude: gpsReal.lat, longitude: gpsReal.lon, latitudeDelta: 0.5, longitudeDelta: 0.5 }}
        onRegionChangeComplete={(region) => {
          setRegionVista(region);
          const diff = calcularDistancia(centroFiltro.lat, centroFiltro.lon, region.latitude, region.longitude);
          if (diff > 5) setMostrarBotonZona(true);
        }}
      >
        <Circle 
          center={{ latitude: centroFiltro.lat, longitude: centroFiltro.lon }} 
          radius={radioKm * 1000} 
          fillColor="rgba(22, 101, 52, 0.1)" 
          strokeColor="rgba(22, 101, 52, 0.3)" 
        />

        {/* Punto de búsqueda central */}
        <Marker coordinate={{ latitude: centroFiltro.lat, longitude: centroFiltro.lon }} title="Buscando desde aquí">
          
        </Marker>

        {/* Tu punto azul */}
        <Marker coordinate={{ latitude: gpsReal.lat, longitude: gpsReal.lon }} title="Tú">
          <View style={styles.puntoGps} />
        </Marker>
        
        {fiestasFiltradas.map((fiesta) => (
          <Marker 
            key={fiesta.id} 
            coordinate={{ latitude: fiesta.ubicacion.latitude, longitude: fiesta.ubicacion.longitude }} 
            onPress={() => {
              router.push({ 
                  pathname: '/detalle', 
                  params: { 
                    id: fiesta.id, nombre: fiesta.nombre, concejo: fiesta.concejo,
                    fecha: fiesta.fecha, orquesta: fiesta.orquesta, imagen: fiesta.imagen,
                    latitud: fiesta.ubicacion.latitude, longitud: fiesta.ubicacion.longitude,
                    esVersity: fiesta.esVersity, linkVersity: fiesta.linkVersity
                  }
              });
            }}
          >
            <View style={[styles.marcador, { borderColor: primaryColor }]} pointerEvents="none">
              <Text style={{ fontSize: 22 }}>{emojiFiesta}</Text>
            </View>
          </Marker>
        ))}
      </MapView>

      {/* BOTONES FLOTANTES LATERALES */}
      <TouchableOpacity style={[styles.btnFlotanteCirculo, { bottom: 95, backgroundColor: primaryColor }]} onPress={() => router.push('/nueva')}>
        <Text style={{fontSize: 30, color: 'white'}}>+</Text>
      </TouchableOpacity>
      
      <TouchableOpacity style={[styles.btnFlotanteCirculo, { bottom: 30, backgroundColor: 'white' }]} onPress={recentrarMapa}>
        <Text style={{fontSize: 24, color: primaryColor}}>📍</Text>
  
      </TouchableOpacity>
    </View>
  );
}
const styles = StyleSheet.create({
  container: { flex: 1 },
  map: { flex: 1 },
  pantallaCarga: { flex: 1, backgroundColor: '#166534', justifyContent: 'center', alignItems: 'center' },
  textoCarga: { color: 'white', fontSize: 18, fontWeight: 'bold', marginTop: 20 },
  panelControl: { paddingTop: 70, paddingHorizontal: 20, paddingBottom: 20  , backgroundColor: '#166534', borderBottomLeftRadius: 30, borderBottomRightRadius: 30, zIndex: 10, elevation: 10 },
  textoLabel: { color: 'white', fontWeight: 'bold', marginBottom: 5 },
  rowFechas: { flexDirection: 'row', marginTop: 15, gap: 10 },
  btnFecha: { flex: 1, backgroundColor: 'rgba(255,255,255,0.1)', padding: 12, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' },
  btnFechaFlexible: { flex: 1 },
  btnActivo: { borderColor: '#F59E0B', backgroundColor: 'rgba(245,158,11,0.2)' },
  lblFecha: { color: '#F59E0B', fontSize: 10, fontWeight: 'bold' },
  valFecha: { color: 'white', fontSize: 14, fontWeight: 'bold' },
  btnLimpiar: { backgroundColor: '#ef4444', paddingHorizontal: 16, paddingVertical: 12, borderRadius: 12, justifyContent: 'center', alignItems: 'center', elevation: 3, shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 2, shadowOffset: {width:0, height:1} },
  lblLimpiar: { color: 'white', fontSize: 16, fontWeight: 'bold' },
  btnBuscarZona: { position: 'absolute', bottom: 30, alignSelf: 'center', backgroundColor: 'white', paddingHorizontal: 20, paddingVertical: 12, borderRadius: 30, elevation: 6, zIndex: 20, shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 4, shadowOffset: {width:0, height:2} },
  textoBusqueda: { color: '#166534', fontWeight: 'bold', fontSize: 16 },

  puntoGps: { width: 20, height: 20, backgroundColor: '#3b82f6', borderRadius: 10, borderWidth: 3, borderColor: 'white', elevation: 5 },
  marcador: { backgroundColor: 'white', padding: 5, borderRadius: 20, borderWidth: 2, borderColor: '#166534' },
  modalCalendario: { position: 'absolute', top: 150, left: 20, right: 20, backgroundColor: 'white', borderRadius: 20, padding: 10, zIndex: 100, elevation: 20 },

  headerPanel: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  btnLupa: { backgroundColor: 'rgba(255,255,255,0.2)', width: 45, height: 45, borderRadius: 22, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)' },
  btnActivoFondo: { backgroundColor: 'rgba(245,158,11,0.4)', borderColor: '#F59E0B' },
  textoLupa: { fontSize: 24 },

  modalFiltrosFondo: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.5)', justifyContent: 'flex-end' },
  modalFiltrosContenido: { backgroundColor: 'white', borderTopLeftRadius: 25, borderTopRightRadius: 25, padding: 20, maxHeight: '80%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitulo: { fontSize: 20, fontWeight: 'bold', color: '#166534' },
  btnCerrarModal: { fontSize: 28, color: '#999', fontWeight: 'bold' },
  inputModal: { backgroundColor: '#f0f0f0', paddingHorizontal: 15, paddingVertical: 12, borderRadius: 10, marginBottom: 12, fontSize: 16, borderWidth: 1, borderColor: '#ddd', color: '#333' },
  btnLimpiarModal: { backgroundColor: '#FFE5CC', padding: 12, borderRadius: 10, alignItems: 'center', marginTop: 15, marginBottom: 10 },
  textoLimpiarModal: { color: '#c2410c', fontWeight: 'bold', fontSize: 14 },
  btnCerrarFiltros: { backgroundColor: '#166534', padding: 15, borderRadius: 10, alignItems: 'center' },
  textoCerrarFiltros: { color: 'white', fontWeight: 'bold', fontSize: 16 },

  btnFlotanteCirculo: { position: 'absolute', right: 20, width: 56, height: 56, borderRadius: 28, justifyContent: 'center', alignItems: 'center', elevation: 5, shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 3, shadowOffset: {width:0, height:2} }
});