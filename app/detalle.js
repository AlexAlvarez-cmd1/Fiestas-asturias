import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { deleteDoc, doc } from 'firebase/firestore';
import { useState } from 'react';
import { ActivityIndicator, Alert, Image, Linking, Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { db } from '../firebaseConfig';

export default function PantallaDetalle() {
  const router = useRouter();
  const params = useLocalSearchParams();
  
  const { id, nombre, concejo, orquesta, imagen, latitud, longitud, fecha, linkVersity, esVersity } = params;
  
  const [modalVisible, setModalVisible] = useState(false);
  const [cargandoEliminar, setCargandoEliminar] = useState(false);
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
      <ScrollView style={styles.container}>
        <Stack.Screen options={{ title: nombre || "Detalles" }} />
        
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
          <TouchableOpacity style={styles.botonCerrarModal} onPress={() => setModalVisible(false)}>
            <Text style={styles.textoCerrar}>❌ Cerrar</Text>
          </TouchableOpacity>
          <Image source={{ uri: imagen }} style={styles.cartelGigante} resizeMode="contain" />
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
  cartelGigante: { width: '100%', height: '85%' },
  botonCerrarModal: { position: 'absolute', top: 50, right: 20, backgroundColor: 'rgba(255,255,255,0.2)', padding: 12, borderRadius: 15 },
  textoCerrar: { color: 'white', fontWeight: 'bold' }
});