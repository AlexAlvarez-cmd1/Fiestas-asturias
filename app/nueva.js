import * as ImageManipulator from 'expo-image-manipulator';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { Stack, useRouter } from 'expo-router';
import { addDoc, collection, GeoPoint } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Image, Platform, ScrollView, StyleSheet, Switch, Text, TextInput, TouchableOpacity, View } from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { useAuth } from '../contexts/AuthContext';
import { db, storage } from '../firebaseConfig';
import { cacheService } from '../services/cacheService';

const CATEGORIAS = ['Romería', 'Verbena', 'Festival', 'Carnaval', 'Feria', 'Otro'];

const comprimirImagen = async (uri) => {
  const result = await ImageManipulator.manipulateAsync(
    uri,
    [{ resize: { width: 900 } }],
    { compress: 0.72, format: ImageManipulator.SaveFormat.JPEG }
  );
  return result.uri;
};

export default function PantallaAñadir() {
  const router = useRouter();
  const { userProfile } = useAuth();
  const [cargando, setCargando] = useState(false);

  useEffect(() => {
    if (!userProfile) return;
    const esAdmin = userProfile.isAdmin === true;
    if (!esAdmin) {
      Alert.alert('Acceso denegado', 'Solo los administradores pueden añadir fiestas.');
      router.replace('/(tabs)');
    }
  }, [userProfile]);

  const [nombre, setNombre] = useState('');
  const [concejo, setConcejo] = useState('');
  const [categoria, setCategoria] = useState('');
  const [orquesta, setOrquesta] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [linkEntradas, setLinkEntradas] = useState('');
  const [fecha, setFecha] = useState(new Date());
  const [esVersity, setEsVersity] = useState(false);
  const [linkVersity, setLinkVersity] = useState('');
  const [imagenUri, setImagenUri] = useState(null);
  const [lat, setLat] = useState(43.3614);
  const [lon, setLon] = useState(-5.8593);
  const [ubicacionSeleccionada, setUbicacionSeleccionada] = useState(null);
  const [mostrarPicker, setMostrarPicker] = useState(false);
  const [errores, setErrores] = useState({});
  const [regionInicial, setRegionInicial] = useState({
    latitude: 43.3614, longitude: -5.8593, latitudeDelta: 0.5, longitudeDelta: 0.5,
  });

  const seleccionarImagen = async () => {
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permissionResult.granted) {
      Alert.alert("Permiso denegado", "Se requieren permisos para acceder a la galería.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [3, 4],
      quality: 1,
    });
    if (!result.canceled) {
      const uri = await comprimirImagen(result.assets[0].uri);
      setImagenUri(uri);
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

  const validar = () => {
    const e = {};
    if (!nombre.trim() || nombre.trim().length < 3) e.nombre = 'El nombre es obligatorio (mín. 3 caracteres)';
    if (!concejo.trim()) e.concejo = 'El concejo es obligatorio';
    if (!ubicacionSeleccionada) e.ubicacion = 'Toca el mapa para seleccionar la ubicación';
    const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
    if (fecha < hoy) e.fecha = 'La fecha debe ser hoy o en el futuro';
    if (esVersity && !linkVersity.trim()) e.linkVersity = 'Añade el enlace de Versity';
    setErrores(e);
    return Object.keys(e).length === 0;
  };

  const guardarFiesta = async () => {
    if (!validar()) return;
    setCargando(true);
    let urlImagenFinal = "https://images.unsplash.com/photo-1533174000228-403285040149?q=80&w=600";
    try {
      if (imagenUri) {
        const response = await fetch(imagenUri);
        const blob = await response.blob();
        const storageRef = ref(storage, `carteles/${Date.now()}.jpg`);
        await uploadBytes(storageRef, blob);
        urlImagenFinal = await getDownloadURL(storageRef);
      }
      await addDoc(collection(db, "fiestas"), {
        nombre,
        concejo,
        categoria,
        orquesta,
        descripcion,
        linkEntradas,
        fecha: fecha.toISOString().split('T')[0],
        imagen: urlImagenFinal,
        ubicacion: new GeoPoint(ubicacionSeleccionada.latitude, ubicacionSeleccionada.longitude),
        esVersity: esVersity ? 'true' : 'false',
        linkVersity: esVersity ? linkVersity : '',
      });
      await cacheService.invalidateCache();
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

        <Text style={styles.label}>Nombre de la Folixa <Text style={styles.req}>*</Text></Text>
        <TextInput
          style={[styles.input, errores.nombre && styles.inputError]}
          value={nombre} onChangeText={t => { setNombre(t); setErrores(e => ({ ...e, nombre: null })); }}
          placeholder="Ej: El Xiringüelu"
        />
        {errores.nombre && <Text style={styles.errorTxt}>{errores.nombre}</Text>}

        <Text style={styles.label}>Concejo <Text style={styles.req}>*</Text></Text>
        <TextInput
          style={[styles.input, errores.concejo && styles.inputError]}
          value={concejo} onChangeText={t => { setConcejo(t); setErrores(e => ({ ...e, concejo: null })); }}
          placeholder="Ej: Pravia"
        />
        {errores.concejo && <Text style={styles.errorTxt}>{errores.concejo}</Text>}

        <Text style={styles.label}>Categoría</Text>
        <View style={styles.categoriasRow}>
          {CATEGORIAS.map(cat => (
            <TouchableOpacity
              key={cat}
              style={[styles.categoriaChip, categoria === cat && styles.categoriaChipActivo]}
              onPress={() => setCategoria(categoria === cat ? '' : cat)}
            >
              <Text style={[styles.categoriaChipTxt, categoria === cat && styles.categoriaChipTxtActivo]}>
                {cat}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.label}>Orquesta / Música</Text>
        <TextInput style={styles.input} value={orquesta} onChangeText={setOrquesta} placeholder="Ej: Panorama, Tekila..." />

        <Text style={styles.label}>Descripción</Text>
        <TextInput
          style={[styles.input, styles.inputMultiline]}
          value={descripcion}
          onChangeText={setDescripcion}
          placeholder="Detalles de la fiesta, horario, programación..."
          multiline
          numberOfLines={4}
          textAlignVertical="top"
        />

        <Text style={styles.label}>🎟️ Enlace para comprar entradas</Text>
        <TextInput
          style={styles.input}
          value={linkEntradas}
          onChangeText={setLinkEntradas}
          placeholder="https://entradas.com/..."
          autoCapitalize="none"
          keyboardType="url"
        />

        <Text style={styles.label}>Fecha <Text style={styles.req}>*</Text></Text>
        <TouchableOpacity
          style={[styles.input, errores.fecha && styles.inputError]}
          onPress={() => setMostrarPicker(true)}
        >
          <Text>{fecha.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</Text>
        </TouchableOpacity>
        {errores.fecha && <Text style={styles.errorTxt}>{errores.fecha}</Text>}
        {mostrarPicker && (
          <DateTimePicker value={fecha} mode="date" display={Platform.OS === 'ios' ? 'inline' : 'default'} onChange={(event, date) => { setMostrarPicker(false); if (date) setFecha(date); }} />
        )}

        <View style={styles.seccionVersity}>
          <View style={styles.rowVersity}>
            <Text style={styles.labelVersity}>🚌 ¿Hay buses de Versity?</Text>
            <Switch
              value={esVersity}
              onValueChange={setEsVersity}
              trackColor={{ false: "#d1d5db", true: "#fdba74" }}
              thumbColor={esVersity ? "#ea580c" : "#f3f4f6"}
            />
          </View>
          {esVersity && (
            <>
              <TextInput
                style={[styles.input, { marginTop: 10 }, errores.linkVersity && styles.inputError]}
                value={linkVersity}
                onChangeText={t => { setLinkVersity(t); setErrores(e => ({ ...e, linkVersity: null })); }}
                placeholder="Pega aquí el enlace de compra"
                autoCapitalize="none"
                keyboardType="url"
              />
              {errores.linkVersity && <Text style={styles.errorTxt}>{errores.linkVersity}</Text>}
            </>
          )}
        </View>

        <Text style={styles.label}>Cartel de la fiesta</Text>
        <TouchableOpacity style={styles.btnGaleria} onPress={seleccionarImagen}>
          <Text style={styles.btnTextoGaleria}>📁 Seleccionar imagen (se comprimirá automáticamente)</Text>
        </TouchableOpacity>
        {imagenUri && <Image source={{ uri: imagenUri }} style={styles.cartelPrevia} />}

        <Text style={styles.label}>Selecciona ubicación en el mapa 📍 <Text style={styles.req}>*</Text></Text>
        {errores.ubicacion && <Text style={styles.errorTxt}>{errores.ubicacion}</Text>}
        <View style={styles.contenedorMapa}>
          <MapView
            style={styles.mapa} initialRegion={regionInicial}
            onPress={(e) => {
              const c = e.nativeEvent.coordinate;
              setUbicacionSeleccionada(c); setLat(c.latitude); setLon(c.longitude);
              setErrores(prev => ({ ...prev, ubicacion: null }));
            }}
          >
            {ubicacionSeleccionada && <Marker coordinate={ubicacionSeleccionada} title="Ubicación elegida" />}
          </MapView>
        </View>
        <View style={styles.cajaCoordenadas}>
          <Text style={styles.textoCoordenadas}>Lat: {lat.toFixed(6)} | Lon: {lon.toFixed(6)}</Text>
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
  req: { color: '#ef4444' },
  input: { backgroundColor: 'white', padding: 15, borderRadius: 10, borderWidth: 1, borderColor: '#ddd' },
  inputMultiline: { minHeight: 100, paddingTop: 12 },
  inputError: { borderColor: '#ef4444', borderWidth: 1.5 },
  errorTxt: { color: '#ef4444', fontSize: 12, marginTop: 4, marginLeft: 4 },

  categoriasRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  categoriaChip: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20,
    backgroundColor: '#f1f5f9', borderWidth: 1, borderColor: '#e2e8f0',
  },
  categoriaChipActivo: { backgroundColor: '#166534', borderColor: '#166534' },
  categoriaChipTxt: { fontSize: 13, fontWeight: '600', color: '#475569' },
  categoriaChipTxtActivo: { color: 'white' },

  seccionVersity: { backgroundColor: '#ffedd5', padding: 15, borderRadius: 10, marginTop: 20, borderWidth: 1, borderColor: '#fdba74' },
  rowVersity: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  labelVersity: { fontWeight: 'bold', color: '#c2410c', fontSize: 16 },

  btnGaleria: { backgroundColor: '#E0E7FF', padding: 15, borderRadius: 10, borderWidth: 1, borderColor: '#C7D2FE', alignItems: 'center' },
  btnTextoGaleria: { color: '#3730A3', fontWeight: 'bold' },
  cartelPrevia: { width: '100%', height: 250, borderRadius: 10, marginTop: 10, resizeMode: 'cover' },
  contenedorMapa: { height: 220, borderRadius: 15, overflow: 'hidden', borderWidth: 1, borderColor: '#ccc', marginTop: 12 },
  mapa: { flex: 1 },
  cajaCoordenadas: { backgroundColor: '#e2e8f0', padding: 10, borderRadius: 8, marginTop: 10, alignItems: 'center' },
  textoCoordenadas: { color: '#334155', fontWeight: 'bold', fontSize: 12 },
  btnGPS: { marginTop: 15, alignSelf: 'flex-end' },
  btnTextGPS: { color: '#F59E0B', fontWeight: 'bold', fontSize: 16 },
  btnGuardar: { backgroundColor: '#166534', padding: 20, borderRadius: 15, marginTop: 40, marginBottom: 30, alignItems: 'center' },
  btnTextGuardar: { color: 'white', fontWeight: 'bold', fontSize: 18 },
});
