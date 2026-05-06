import DateTimePicker from '@react-native-community/datetimepicker';
import * as ImagePicker from 'expo-image-picker';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { doc, GeoPoint, updateDoc } from 'firebase/firestore'; // Usamos updateDoc para NO duplicar
import { useState } from 'react';
import { ActivityIndicator, Alert, Image, ScrollView, StyleSheet, Switch, Text, TextInput, TouchableOpacity, View } from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import { db } from '../firebaseConfig';

const IMGBB_API_KEY = "9b4357ae333c6076d71703a13108b4b4";

export default function PantallaEditar() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const [cargando, setCargando] = useState(false);

  const [nombre, setNombre] = useState(params.nombre || '');
  const [concejo, setConcejo] = useState(params.concejo || '');
  const [orquesta, setOrquesta] = useState(params.orquesta || '');
  const [fecha, setFecha] = useState(params.fecha ? new Date(params.fecha) : new Date());
  
  const [imagenUri, setImagenUri] = useState(params.imagen || null);
  const [imagenBase64, setImagenBase64] = useState(null);
  
  const [esVersity, setEsVersity] = useState(params.esVersity === 'true');
  const [linkVersity, setLinkVersity] = useState(params.linkVersity || '');

  const [lat, setLat] = useState(parseFloat(params.latitud) || 43.3614);
  const [lon, setLon] = useState(parseFloat(params.longitud) || -5.8593);
  const [ubicacionSeleccionada, setUbicacionSeleccionada] = useState({ 
    latitude: parseFloat(params.latitud) || 43.3614, 
    longitude: parseFloat(params.longitud) || -5.8593 
  });

  const [mostrarPicker, setMostrarPicker] = useState(false);

  const seleccionarImagen = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'], allowsEditing: true, aspect: [3, 4], quality: 0.4, base64: true,
    });
    if (!result.canceled) {
      setImagenUri(result.assets[0].uri);
      setImagenBase64(result.assets[0].base64);
    }
  };

  const guardarCambios = async () => {
    if (!nombre || !concejo) {
      Alert.alert("Error", "Faltan datos obligatorios.");
      return;
    }

    setCargando(true);
    let urlImagenFinal = imagenUri;

    try {
      if (imagenBase64) {
        const formData = new FormData();
        formData.append('image', imagenBase64);
        const res = await fetch(`https://api.imgbb.com/1/upload?key=${IMGBB_API_KEY}`, { method: 'POST', body: formData });
        const data = await res.json();
        if (data.success) urlImagenFinal = data.data.url;
      }

      // LA MAGIA OCURRE AQUÍ: updateDoc actualiza, no duplica.
      const fiestaRef = doc(db, "fiestas", params.id);
      
      await updateDoc(fiestaRef, {
        nombre,
        concejo,
        orquesta,
        fecha: fecha.toISOString().split('T')[0],
        imagen: urlImagenFinal,
        ubicacion: new GeoPoint(ubicacionSeleccionada.latitude, ubicacionSeleccionada.longitude),
        esVersity: esVersity ? 'true' : 'false',
        linkVersity: esVersity ? linkVersity : ''
      });
      
      Alert.alert("¡Hecho!", "Fiesta actualizada correctamente.");
      router.replace('/mapa');
    } catch (error) {
      console.error(error);
      Alert.alert("Error", "No se pudieron guardar los cambios.");
    }
    setCargando(false);
  };

  return (
    <ScrollView style={styles.container}>
      <Stack.Screen options={{ title: "Editar " + nombre }} />
      <View style={styles.formulario}>
        <Text style={styles.label}>Nombre</Text>
        <TextInput style={styles.input} value={nombre} onChangeText={setNombre} />

        <Text style={styles.label}>Concejo</Text>
        <TextInput style={styles.input} value={concejo} onChangeText={setConcejo} />

        <Text style={styles.label}>Música / Orquesta</Text>
        <TextInput style={styles.input} value={orquesta} onChangeText={setOrquesta} />

        <Text style={styles.label}>Fecha</Text>
        <TouchableOpacity style={styles.input} onPress={() => setMostrarPicker(true)}>
          <Text>{fecha.toLocaleDateString('es-ES')}</Text>
        </TouchableOpacity>

        {mostrarPicker && (
          <DateTimePicker value={fecha} mode="date" display="default" onChange={(e, d) => { setMostrarPicker(false); if(d) setFecha(d); }} />
        )}

        <View style={styles.seccionVersity}>
          <View style={styles.rowVersity}>
            <Text style={styles.labelVersity}>🚌 Servicio Versity</Text>
            <Switch value={esVersity} onValueChange={setEsVersity} />
          </View>
          {esVersity && <TextInput style={styles.input} value={linkVersity} onChangeText={setLinkVersity} placeholder="Enlace de Versity" />}
        </View>

        <Text style={styles.label}>Imagen del Cartel</Text>
        <TouchableOpacity style={styles.btnGaleria} onPress={seleccionarImagen}>
          <Text style={styles.btnTextoGaleria}>Seleccionar Nueva Imagen</Text>
        </TouchableOpacity>
        {imagenUri && <Image source={{ uri: imagenUri }} style={styles.cartelPrevia} />}

        <Text style={styles.label}>Ubicación (Toca el mapa para cambiarla)</Text>
        <View style={styles.contenedorMapa}>
          <MapView 
            style={styles.mapa} 
            initialRegion={{ latitude: lat, longitude: lon, latitudeDelta: 0.01, longitudeDelta: 0.01 }}
            onPress={(e) => setUbicacionSeleccionada(e.nativeEvent.coordinate)}
          >
            <Marker coordinate={ubicacionSeleccionada} />
          </MapView>
        </View>

        <TouchableOpacity style={styles.btnGuardar} onPress={guardarCambios} disabled={cargando}>
          {cargando ? <ActivityIndicator color="white" /> : <Text style={styles.btnTextGuardar}>ACTUALIZAR DATOS</Text>}
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f4f4f4' },
  formulario: { padding: 20 },
  label: { fontWeight: 'bold', color: '#166534', marginBottom: 5, marginTop: 15 },
  input: { backgroundColor: 'white', padding: 15, borderRadius: 10, borderWidth: 1, borderColor: '#ddd' },
  seccionVersity: { backgroundColor: '#ffedd5', padding: 15, borderRadius: 10, marginTop: 20, borderWidth: 1, borderColor: '#fdba74' },
  rowVersity: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  labelVersity: { fontWeight: 'bold', color: '#c2410c' },
  btnGaleria: { backgroundColor: '#e2e8f0', padding: 15, borderRadius: 10, alignItems: 'center' },
  btnTextoGaleria: { fontWeight: 'bold', color: '#475569' },
  cartelPrevia: { width: '100%', height: 250, borderRadius: 10, marginTop: 10, resizeMode: 'cover' },
  contenedorMapa: { height: 250, borderRadius: 15, overflow: 'hidden', marginTop: 10, borderWidth: 1, borderColor: '#ccc' },
  mapa: { flex: 1 },
  btnGuardar: { backgroundColor: '#166534', padding: 20, borderRadius: 15, marginTop: 40, alignItems: 'center' },
  btnTextGuardar: { color: 'white', fontWeight: 'bold', fontSize: 18 }
});