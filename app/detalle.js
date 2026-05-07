import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { deleteDoc, doc, increment, onSnapshot, updateDoc } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Image, Linking, Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { db } from '../firebaseConfig';
import { useFavorite } from '../hooks/useFavorite';
import { storageService } from '../services/storageService';

export default function PantallaDetalle() {
  const router = useRouter();
  const params = useLocalSearchParams();
  
  const { id, nombre, concejo, orquesta, imagen, latitud, longitud, fecha, linkVersity, esVersity } = params;
  
  const [modalVisible, setModalVisible] = useState(false);
  const [cargandoEliminar, setCargandoEliminar] = useState(false);
  
  // Asistencia
  const [asistentesCount, setAsistentesCount] = useState(0);
  const [hasAttended, setHasAttended] = useState(false);
  const [loadingAttendance, setLoadingAttendance] = useState(true);
  
  // Hook para favoritos
  const { isFavorite, toggleFavorite, loading: loadingFavorite } = useFavorite(id);

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
        await updateDoc(fiestaRef, {
          asistentes: increment(1)
        });
      } else {
        await storageService.removeItem(`attended_${id}`);
        await updateDoc(fiestaRef, {
          asistentes: increment(-1)
        });
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
    <SafeAreaView style={{ flex: 1, backgroundColor: '#f4f4f4' }}>
      <Stack.Screen 
        options={{ 
          title: nombre || "Detalles",
          headerLeft: () => (
            <TouchableOpacity onPress={() => router.back()} style={{ paddingLeft: 10 }}>
              <Text style={{ fontSize: 24 }}>← Atrás</Text>
            </TouchableOpacity>
          ),
          headerRight: () => (
            <TouchableOpacity 
              onPress={toggleFavorite} 
              style={{ paddingRight: 15 }}
              disabled={loadingFavorite}
            >
              <Text style={{ fontSize: 28, backgroundColor: '#fffffff1' }}>
                {loadingFavorite ? '...' : isFavorite ? '❤️' : '♡'}
              </Text>
            </TouchableOpacity>
          )
        }} 
      />
      <ScrollView style={styles.container}>
        
        <View style={styles.infoCard}>
          {imagen && (
            <TouchableOpacity activeOpacity={0.8} onPress={() => setModalVisible(true)}>
              <View style={styles.contenedorCartelPequeño}>
                <Image source={{ uri: imagen }} style={styles.cartel} resizeMode="cover" />
                <View style={styles.etiquetaAmpliar}>
                  <Text style={styles.textoAmpliar}>🔍 Ver cartel completo</Text>
                </View>
              </View>
            </TouchableOpacity>
          )}

          <View style={styles.textoContainer}>
            <Text style={styles.label}>📅 Fecha</Text>
            <Text style={styles.value}>{fechaFormateada}</Text>
            
            <Text style={styles.label}>🎪 Lugar</Text>
            <Text style={styles.value}>{nombre} ({concejo})</Text>

            <Text style={styles.label}>🎵 Música</Text>
            <Text style={styles.value}>{orquesta || 'Por confirmar'}</Text>

            {/* BOTÓN ASISTENCIA */}
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

              {/* BOTÓN VERSITY DINÁMICO */}
              {esVersity === 'true' && (
                <TouchableOpacity style={[styles.btnOpcion, styles.btnVersity]} onPress={() => Linking.openURL(linkVersity)}>
                  <Text style={styles.emoji}>🎒</Text>
                  <Text style={styles.btnTexto}>Versity</Text>
                </TouchableOpacity>
              )}

              {/* BOTÓN URBANO DINÁMICO (TUA, EMTUSA, etc.) */}
              {infoUrbano && (
                <TouchableOpacity 
                  style={[styles.btnOpcion, { backgroundColor: infoUrbano.color }]} 
                  onPress={() => Linking.openURL(infoUrbano.url)}
                >
                  <Text style={styles.emoji}>🏙️</Text>
                  <Text style={styles.btnTexto}>{infoUrbano.nombre}</Text>
                </TouchableOpacity>
              )}
            </View>

            <TouchableOpacity 
              style={styles.btnEditar} 
              onPress={() => router.push({ pathname: '/editar', params: params })}
            >
              <Text style={styles.btnTextoEditar}>📝 EDITAR FIESTA</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.botonEliminar} onPress={manejarEliminacion} disabled={cargandoEliminar}>
              {cargandoEliminar ? <ActivityIndicator color="#666" /> : <Text style={styles.btnTextEliminar}>Eliminar esta fiesta</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>

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
  contenedorCartelPequeño: { position: 'relative' },
  cartel: { width: '100%', height: 300 },
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
  btnEditar: { backgroundColor: '#e2e8f0', padding: 15, borderRadius: 15, alignItems: 'center', marginTop: 20 },
  btnTextoEditar: { color: '#475569', fontWeight: 'bold' },
  botonEliminar: { marginTop: 30, alignItems: 'center', padding: 10 },
  btnTextEliminar: { color: '#94a3b8', fontSize: 13, textDecorationLine: 'underline' },
  modalFondo: { flex: 1, backgroundColor: 'rgba(0,0,0,0.95)', justifyContent: 'center', alignItems: 'center' },
  areaZoomAtrás: { flex: 1, justifyContent: 'center', alignItems: 'center', width: '100%' },
  cartelGigante: { width: '100%', height: '85%' },
  botonCerrarModal: { position: 'absolute', top: 40, right: 20, backgroundColor: 'rgba(239, 68, 68, 0.9)', padding: 15, borderRadius: 50, zIndex: 100, minWidth: 60, height: 60, justifyContent: 'center', alignItems: 'center', elevation: 10 },
  textoCerrar: { color: 'white', fontWeight: 'bold', fontSize: 24, textAlign: 'center' },
  textoBotonCerrar: { color: 'white', fontWeight: 'bold', fontSize: 10, marginTop: 2, textAlign: 'center' }
});