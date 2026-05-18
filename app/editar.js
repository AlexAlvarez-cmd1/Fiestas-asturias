import * as ImageManipulator from 'expo-image-manipulator';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as ImagePicker from 'expo-image-picker';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { doc, GeoPoint, serverTimestamp, updateDoc } from 'firebase/firestore';
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

export default function PantallaEditar() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { userProfile } = useAuth();
  const [cargando, setCargando] = useState(false);

  useEffect(() => {
    if (!userProfile) return;
    const esAdmin = userProfile.isAdmin === true;
    if (!esAdmin) {
      Alert.alert('Acceso denegado', 'Solo los administradores pueden editar fiestas.');
      router.replace('/(tabs)');
    }
  }, [userProfile]);

  const [nombre, setNombre] = useState(params.nombre || '');
  const [concejo, setConcejo] = useState(params.concejo || '');
  const [categoria, setCategoria] = useState(params.categoria || '');
  const [orquesta, setOrquesta] = useState(params.orquesta || '');
  const [descripcion, setDescripcion] = useState(params.descripcion || '');
  const [linkEntradas, setLinkEntradas] = useState(params.linkEntradas || '');
  const [fecha, setFecha] = useState(params.fecha ? new Date(params.fecha) : new Date());
  const [imagenUri, setImagenUri] = useState(params.imagen || null);
  const [nuevaImagenUri, setNuevaImagenUri] = useState(null);
  const [esVersity, setEsVersity] = useState(params.esVersity === 'true');
  const [linkVersity, setLinkVersity] = useState(params.linkVersity || '');
  const [lat, setLat] = useState(parseFloat(params.latitud) || 43.3614);
  const [lon, setLon] = useState(parseFloat(params.longitud) || -5.8593);
  const [ubicacionSeleccionada, setUbicacionSeleccionada] = useState({
    latitude: parseFloat(params.latitud) || 43.3614,
    longitude: parseFloat(params.longitud) || -5.8593,
  });
  const [mostrarPicker, setMostrarPicker] = useState(false);
  const [errores, setErrores] = useState({});

  const seleccionarImagen = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'], allowsEditing: true, aspect: [3, 4], quality: 1,
    });
    if (!result.canceled) {
      const uri = await comprimirImagen(result.assets[0].uri);
      setImagenUri(uri);
      setNuevaImagenUri(uri);
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
      await updateDoc(doc(db, "fiestas", params.id), {
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
        lastUpdated: serverTimestamp(),
      });
      await cacheService.invalidateCache();
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

        <Text style={styles.label}>Música / Orquesta</Text>
        <TextInput style={styles.input} value={orquesta} onChangeText={setOrquesta} />

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

        <Text style={styles.label}>Fecha</Text>
        <TouchableOpacity style={styles.input} onPress={() => setMostrarPicker(true)}>
          <Text>{fecha.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</Text>
        </TouchableOpacity>
        {mostrarPicker && (
          <DateTimePicker value={fecha} mode="date" display={Platform.OS === 'ios' ? 'inline' : 'default'} onChange={(e, d) => { setMostrarPicker(false); if (d) setFecha(d); }} />
        )}

        <View style={styles.seccionVersity}>
          <View style={styles.rowVersity}>
            <Text style={styles.labelVersity}>🚌 Servicio Versity</Text>
            <Switch value={esVersity} onValueChange={setEsVersity} />
          </View>
          {esVersity && (
            <>
              <TextInput
                style={[styles.input, { marginTop: 10 }, errores.linkVersity && styles.inputError]}
                value={linkVersity}
                onChangeText={t => { setLinkVersity(t); setErrores(e => ({ ...e, linkVersity: null })); }}
                placeholder="Enlace de Versity"
                autoCapitalize="none"
                keyboardType="url"
              />
              {errores.linkVersity && <Text style={styles.errorTxt}>{errores.linkVersity}</Text>}
            </>
          )}
        </View>

        <Text style={styles.label}>Imagen del Cartel</Text>
        <TouchableOpacity style={styles.btnGaleria} onPress={seleccionarImagen}>
          <Text style={styles.btnTextoGaleria}>📁 Cambiar imagen (se comprimirá automáticamente)</Text>
        </TouchableOpacity>
        {imagenUri && <Image source={{ uri: imagenUri }} style={styles.cartelPrevia} />}

        <Text style={styles.label}>Ubicación (Toca el mapa para cambiarla)</Text>
        <View style={styles.contenedorMapa}>
          <MapView
            style={styles.mapa}
            initialRegion={{ latitude: lat, longitude: lon, latitudeDelta: 0.01, longitudeDelta: 0.01 }}
            onPress={(e) => {
              const c = e.nativeEvent.coordinate;
              setUbicacionSeleccionada(c);
              setLat(c.latitude);
              setLon(c.longitude);
            }}
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
  labelVersity: { fontWeight: 'bold', color: '#c2410c' },
  btnGaleria: { backgroundColor: '#e2e8f0', padding: 15, borderRadius: 10, alignItems: 'center' },
  btnTextoGaleria: { fontWeight: 'bold', color: '#475569' },
  cartelPrevia: { width: '100%', height: 250, borderRadius: 10, marginTop: 10, resizeMode: 'cover' },
  contenedorMapa: { height: 250, borderRadius: 15, overflow: 'hidden', marginTop: 10, borderWidth: 1, borderColor: '#ccc' },
  mapa: { flex: 1 },
  btnGuardar: { backgroundColor: '#166534', padding: 20, borderRadius: 15, marginTop: 40, marginBottom: 30, alignItems: 'center' },
  btnTextGuardar: { color: 'white', fontWeight: 'bold', fontSize: 18 },
});
