import DateTimePicker from '@react-native-community/datetimepicker';
import * as ImagePicker from 'expo-image-picker';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { doc, GeoPoint, serverTimestamp, updateDoc } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Image, ScrollView, StyleSheet, Switch, Text, TextInput, TouchableOpacity, View } from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { useAuth } from '../contexts/AuthContext';
import { db, storage } from '../firebaseConfig';

export default function PantallaEditar() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { userProfile } = useAuth();
  const [cargando, setCargando] = useState(false);

  useEffect(() => {
    if (!userProfile) return;
    const esAdmin = userProfile.isAdmin === true || userProfile.isAdmin === 'true';
    if (!esAdmin) {
      Alert.alert('Acceso denegado', 'Solo los administradores pueden editar fiestas.');
      router.replace('/(tabs)');
    }
  }, [userProfile]);

  const [nombre, setNombre] = useState(params.nombre || '');
  const [concejo, setConcejo] = useState(params.concejo || '');
  const [orquesta, setOrquesta] = useState(params.orquesta || '');
  const [fecha, setFecha] = useState(params.fecha ? new Date(params.fecha) : new Date());
  
  const [imagenUri, setImagenUri] = useState(params.imagen || null);
  const [nuevaImagenUri, setNuevaImagenUri] = useState(null);
  
  const [esVersity, setEsVersity] = useState(params.esVersity === 'true');
  const [linkVersity, setLinkVersity] = useState(params.linkVersity || '');

  const [lat, setLat] = useState(parseFloat(params.latitud) || 43.3614);
  const [lon, setLon] = useState(parseFloat(params.longitud) || -5.8593);
  const [ubicacionSeleccionada, setUbicacionSeleccionada] = useState({ 
    latitude: parseFloat(params.latitud) || 43.3614, 
    longitude: parseFloat(params.longitud) || -5.8593 
  });

  const [mostrarPicker, setMostrarPicker] = useState(false);
  const [errores, setErrores] = useState({});

  const seleccionarImagen = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'], allowsEditing: true, aspect: [3, 4], quality: 0.6,
    });
    if (!result.canceled) {
      setImagenUri(result.assets[0].uri);
      setNuevaImagenUri(result.assets[0].uri);
    }
  };

  const validar = () => {
    const e = {};
    if (!nombre.trim() || nombre.trim().length < 3) e.nombre = 'El nombre es obligatorio (mín. 3 caracteres)';
    if (!concejo.trim()) e.concejo = 'El concejo es obligatorio';
    if (esVersity && !linkVersity.trim()) e.linkVersity = 'Añade el enlace de Versity';
    setErrores(e);
    return Object.keys(e).length === 0;
  };

  const guardarCambios = async () => {
    if (!validar()) return;

    setCargando(true);
    let urlImagenFinal = imagenUri;

    try {
      if (nuevaImagenUri) {
        const response = await fetch(nuevaImagenUri);
        const blob = await response.blob();
        const storageRef = ref(storage, `carteles/${Date.now()}.jpg`);
        await uploadBytes(storageRef, blob);
        urlImagenFinal = await getDownloadURL(storageRef);
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
        linkVersity: esVersity ? linkVersity : '',
        lastUpdated: serverTimestamp(),
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
        <Text style={styles.label}>Nombre <Text style={styles.req}>*</Text></Text>
        <TextInput
          style={[styles.input, errores.nombre && styles.inputError]}
          value={nombre} onChangeText={t => { setNombre(t); setErrores(e => ({ ...e, nombre: null })); }}
        />
        {errores.nombre && <Text style={styles.errorTxt}>{errores.nombre}</Text>}

        <Text style={styles.label}>Concejo <Text style={styles.req}>*</Text></Text>
        <TextInput
          style={[styles.input, errores.concejo && styles.inputError]}
          value={concejo} onChangeText={t => { setConcejo(t); setErrores(e => ({ ...e, concejo: null })); }}
        />
        {errores.concejo && <Text style={styles.errorTxt}>{errores.concejo}</Text>}

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
          {esVersity && (
            <>
              <TextInput
                style={[styles.input, errores.linkVersity && styles.inputError]}
                value={linkVersity}
                onChangeText={t => { setLinkVersity(t); setErrores(e => ({ ...e, linkVersity: null })); }}
                placeholder="Enlace de Versity"
              />
              {errores.linkVersity && <Text style={styles.errorTxt}>{errores.linkVersity}</Text>}
            </>
          )}
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
  req: { color: '#ef4444' },
  input: { backgroundColor: 'white', padding: 15, borderRadius: 10, borderWidth: 1, borderColor: '#ddd' },
  inputError: { borderColor: '#ef4444', borderWidth: 1.5 },
  errorTxt: { color: '#ef4444', fontSize: 12, marginTop: 4, marginLeft: 4 },
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