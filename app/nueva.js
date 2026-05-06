import DateTimePicker from '@react-native-community/datetimepicker';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { Stack, useRouter } from 'expo-router';
import { addDoc, collection, GeoPoint } from 'firebase/firestore';
import { useState } from 'react';
import { ActivityIndicator, Alert, Image, Platform, ScrollView, StyleSheet, Switch, Text, TextInput, TouchableOpacity, View } from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import { db } from '../firebaseConfig';

// Pega tu API Key de ImgBB entre las comillas
const IMGBB_API_KEY = "9b4357ae333c6076d71703a13108b4b4";

export default function PantallaAñadir() {
  const router = useRouter();
  const [cargando, setCargando] = useState(false);

  // Estados del formulario general
  const [nombre, setNombre] = useState('');
  const [concejo, setConcejo] = useState('');
  const [orquesta, setOrquesta] = useState('');
  const [fecha, setFecha] = useState(new Date());
  
  // ESTADOS NUEVOS PARA VERSITY
  const [esVersity, setEsVersity] = useState(false);
  const [linkVersity, setLinkVersity] = useState('');

  // Guardamos la imagen y su versión en texto (base64) para ImgBB
  const [imagenUri, setImagenUri] = useState(null);
  const [imagenBase64, setImagenBase64] = useState(null);

  const [lat, setLat] = useState(43.3614);
  const [lon, setLon] = useState(-5.8593);
  const [ubicacionSeleccionada, setUbicacionSeleccionada] = useState(null);
  const [mostrarPicker, setMostrarPicker] = useState(false);

  const [regionInicial, setRegionInicial] = useState({
    latitude: 43.3614, longitude: -5.8593, latitudeDelta: 0.5, longitudeDelta: 0.5,
  });

  // 1. ABRIR GALERÍA
  const seleccionarImagen = async () => {
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (permissionResult.granted === false) {
      Alert.alert("Permiso denegado", "Se requieren permisos para acceder a la galería.");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [3, 4], 
      quality: 0.4, 
      base64: true, 
    });

    if (!result.canceled) {
      setImagenUri(result.assets[0].uri);
      setImagenBase64(result.assets[0].base64); 
    }
  };

  const capturarUbicacionActual = async () => {
    setCargando(true);
    let { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert("Permiso denegado", "Necesitamos acceso al GPS para capturar la ubicación.");
      setCargando(false); return;
    }
    let location = await Location.getCurrentPositionAsync({});
    const nuevaLat = location.coords.latitude;
    const nuevaLon = location.coords.longitude;

    setLat(nuevaLat); setLon(nuevaLon);
    setUbicacionSeleccionada({ latitude: nuevaLat, longitude: nuevaLon });
    setRegionInicial({ latitude: nuevaLat, longitude: nuevaLon, latitudeDelta: 0.05, longitudeDelta: 0.05 });
    setCargando(false);
  };

  // 2. SUBIR A IMGBB Y GUARDAR EN FIREBASE FIRESTORE
  const guardarFiesta = async () => {
    if (!nombre || !concejo || !ubicacionSeleccionada || !fecha) {
      Alert.alert("Faltan datos", "Por favor, rellena los campos y selecciona la ubicación en el mapa.");
      return;
    }

    setCargando(true);
    let urlImagenFinal = "https://images.unsplash.com/photo-1533174000228-403285040149?q=80&w=600";

    try {
      if (imagenBase64) {
        const formData = new FormData();
        formData.append('image', imagenBase64);

        const respuestaImgbb = await fetch(`https://api.imgbb.com/1/upload?key=${IMGBB_API_KEY}`, {
          method: 'POST',
          body: formData,
        });

        const datosImgbb = await respuestaImgbb.json();
        
        if (datosImgbb.success) {
           urlImagenFinal = datosImgbb.data.url; 
        } else {
           Alert.alert("Error de imagen", "No se pudo subir la foto, pero guardaremos la fiesta sin ella.");
        }
      }

      // Guardamos en Firebase (INCLUYENDO VERSITY)
      await addDoc(collection(db, "fiestas"), {
        nombre,
        concejo,
        orquesta,
        fecha: fecha.toISOString().split('T')[0],
        imagen: urlImagenFinal,
        ubicacion: new GeoPoint(ubicacionSeleccionada.latitude, ubicacionSeleccionada.longitude),
        esVersity: esVersity ? 'true' : 'false', // Guardamos como texto para que el router lo lea fácil
        linkVersity: esVersity ? linkVersity : ''
      });
      
      Alert.alert("¡Éxito!", "Fiesta añadida correctamente.");
      router.replace('/mapa');
    } catch (error) {
      console.error(error);
      Alert.alert("Error", "Hubo un error al publicar la fiesta.");
    }
    setCargando(false);
  };

  return (
    <ScrollView style={styles.container}>
      <Stack.Screen options={{ title: "Nueva Fiesta de Prao" }} />
      
      <View style={styles.formulario}>
        <Text style={styles.label}>Nombre de la Folixa</Text>
        <TextInput style={styles.input} value={nombre} onChangeText={setNombre} placeholder="Ej: El Xiringüelu" />

        <Text style={styles.label}>Concejo</Text>
        <TextInput style={styles.input} value={concejo} onChangeText={setConcejo} placeholder="Ej: Pravia" />

        <Text style={styles.label}>Orquesta / Música</Text>
        <TextInput style={styles.input} value={orquesta} onChangeText={setOrquesta} placeholder="Ej: Panorama, Tekila..." />

        <Text style={styles.label}>Fecha</Text>
        <TouchableOpacity style={styles.input} onPress={() => setMostrarPicker(true)}>
          <Text>{fecha.toLocaleDateString('es-ES')}</Text>
        </TouchableOpacity>

        {mostrarPicker && (
          <DateTimePicker value={fecha} mode="date" display={Platform.OS === 'ios' ? 'inline' : 'default'} onChange={(event, date) => { setMostrarPicker(false); if (date) setFecha(date); }} />
        )}

        {/* --- SECCIÓN VERSITY --- */}
        <View style={styles.seccionVersity}>
          <View style={styles.rowVersity}>
            <Text style={styles.labelVersity}>🚌 ¿Hay buses de Versity?</Text>
            <Switch 
              value={esVersity} 
              onValueChange={setEsVersity}
              trackColor={{ false: "#d1d5db", true: "#fdba74" }} // Naranja clarito
              thumbColor={esVersity ? "#ea580c" : "#f3f4f6"} // Naranja oscuro
            />
          </View>
          
          {esVersity && (
            <TextInput 
              style={[styles.input, { marginTop: 10 }]} 
              value={linkVersity} 
              onChangeText={setLinkVersity} 
              placeholder="Pega aquí el enlace de compra" 
              autoCapitalize="none"
              keyboardType="url"
            />
          )}
        </View>

        <Text style={styles.label}>Cartel del Prao</Text>
        <TouchableOpacity style={styles.btnGaleria} onPress={seleccionarImagen}>
          <Text style={styles.btnTextoGaleria}>📁 Seleccionar imagen de la galería</Text>
        </TouchableOpacity>

        {imagenUri && (
          <Image source={{ uri: imagenUri }} style={styles.cartelPrevia} />
        )}

        <Text style={styles.label}>Selecciona ubicación en el mapa 📍</Text>
        <View style={styles.contenedorMapa}>
          <MapView
            style={styles.mapa} initialRegion={regionInicial}
            onPress={(e) => {
              const nuevaCoords = e.nativeEvent.coordinate;
              setUbicacionSeleccionada(nuevaCoords); setLat(nuevaCoords.latitude); setLon(nuevaCoords.longitude);
            }}
          >
            {ubicacionSeleccionada && ( <Marker coordinate={ubicacionSeleccionada} title="Ubicación elegida" /> )}
          </MapView>
        </View>

        <View style={styles.cajaCoordenadas}>
          <Text style={styles.textoCoordenadas}> Latitud: {lat.toFixed(6)} | Longitud: {lon.toFixed(6)} </Text>
        </View>

        <TouchableOpacity style={styles.btnGPS} onPress={capturarUbicacionActual}>
          <Text style={styles.btnTextGPS}>📍 Usar mi ubicación actual</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.btnGuardar} onPress={guardarFiesta} disabled={cargando}>
          {cargando ? <ActivityIndicator color="white" /> : <Text style={styles.btnTextGuardar}>PUBLICAR FIESTA</Text>}
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
  
  // Estilos de Versity
  seccionVersity: { backgroundColor: '#ffedd5', padding: 15, borderRadius: 10, marginTop: 20, borderWidth: 1, borderColor: '#fdba74' },
  rowVersity: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  labelVersity: { fontWeight: 'bold', color: '#c2410c', fontSize: 16 },

  btnGaleria: { backgroundColor: '#E0E7FF', padding: 15, borderRadius: 10, borderWidth: 1, borderColor: '#C7D2FE', alignItems: 'center' },
  btnTextoGaleria: { color: '#3730A3', fontWeight: 'bold' },
  cartelPrevia: { width: '100%', height: 250, borderRadius: 10, marginTop: 10, resizeMode: 'cover' },
  contenedorMapa: { height: 220, borderRadius: 15, overflow: 'hidden', borderWidth: 1, borderColor: '#ccc', marginTop: 12 },
  mapa: { flex: 1 },
  cajaCoordenadas: { backgroundColor: '#e2e8f0', padding: 10, borderRadius: 8, marginTop: 10, alignItems: 'center' },
  textoCoordenadas: { color: '#334155', fontWeight: 'bold' },
  btnGPS: { marginTop: 15, alignSelf: 'flex-end' },
  btnTextGPS: { color: '#F59E0B', fontWeight: 'bold', fontSize: 16 },
  btnGuardar: { backgroundColor: '#166534', padding: 20, borderRadius: 15, marginTop: 40, alignItems: 'center' },
  btnTextGuardar: { color: 'white', fontWeight: 'bold', fontSize: 18 }
});