import { useFocusEffect, useRouter } from 'expo-router';
import { collection, getDocs } from 'firebase/firestore';
import { useCallback, useState } from 'react';
import { ImageBackground, RefreshControl, ScrollView, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../contexts/AuthContext';
import { useConfig } from '../../contexts/ConfigContext';
import { db } from '../../firebaseConfig';
import { cacheService } from '../../services/cacheService';
import { userService } from '../../services/userService';

const fondoImagen = { uri: 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/3e/Flag_of_Asturias.svg/1280px-Flag_of_Asturias.svg.png' };

export default function PantallaHome() {
  const router = useRouter();
  const { emojiFiesta, primaryColor, textColor } = useConfig();
  const { user } = useAuth();

  const [stats, setStats] = useState(null);
  const [actividadAmigos, setActividadAmigos] = useState([]);
  const [refreshing, setRefreshing] = useState(false);

  const cargar = useCallback(async () => {
    try {
      let fiestas = await cacheService.getCachedFiestas();
      if (!fiestas || fiestas.length === 0) {
        const snap = await getDocs(collection(db, 'fiestas'));
        fiestas = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      }
      if (!fiestas || fiestas.length === 0) return;

      const masVista = fiestas.reduce((max, f) =>
        (f.vistas || 0) > (max.vistas || 0) ? f : max, fiestas[0]);
      const masAsistentes = fiestas.reduce((max, f) =>
        (f.asistentes || 0) > (max.asistentes || 0) ? f : max, fiestas[0]);
      const concejos = {};
      fiestas.forEach(f => {
        if (f.concejo) concejos[f.concejo] = (concejos[f.concejo] || 0) + 1;
      });
      const topConcejo = Object.entries(concejos).sort((a, b) => b[1] - a[1])[0];

      setStats({ masVista, masAsistentes, topConcejo });

      if (user) {
        const amigos = await userService.getFriends(user.uid);
        const porFiesta = {};
        amigos.forEach(amigo => {
          (amigo.asistencias || []).forEach(fiestaId => {
            if (!porFiesta[fiestaId]) porFiesta[fiestaId] = [];
            porFiesta[fiestaId].push(amigo.username);
          });
        });
        const actividad = Object.entries(porFiesta)
          .map(([fiestaId, nombres]) => {
            const fiesta = fiestas.find(f => f.id === fiestaId);
            return fiesta ? { fiesta, nombres } : null;
          })
          .filter(Boolean)
          .slice(0, 5);
        setActividadAmigos(actividad);
      }
    } catch (error) {
      console.warn('Error cargando home:', error);
    } finally {
      setRefreshing(false);
    }
  }, [user]);

  useFocusEffect(useCallback(() => { cargar(); }, [cargar]));

  const onRefresh = () => {
    setRefreshing(true);
    cargar();
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      <ImageBackground source={fondoImagen} style={styles.backgroundImage} resizeMode="cover">
        <View style={styles.overlay}>
          <SafeAreaView style={styles.content}>
            <ScrollView
              contentContainerStyle={styles.scroll}
              showsVerticalScrollIndicator={false}
              refreshControl={
                <RefreshControl
                  refreshing={refreshing}
                  onRefresh={onRefresh}
                  tintColor="#fbbf24"
                  colors={['#fbbf24']}
                />
              }
            >
              {/* Cabecera */}
              <View style={styles.header}>
                <Text style={styles.logoEmoji}>{emojiFiesta}</Text>
                <Text style={styles.titulo}>Fiestas de prao</Text>
                <Text style={styles.subtitulo}>Encuentra folixa cerca de ti</Text>
              </View>

              {/* Botón principal */}
              <TouchableOpacity
                style={[styles.boton, { backgroundColor: primaryColor }]}
                onPress={() => router.push('/mapa')}
              >
                <Text style={[styles.textoBoton, { color: textColor }]}>IR AL MAPA</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.botonLista}
                onPress={() => router.push('/lista')}
              >
                <Text style={styles.textoBotonLista}>📋 Ver lista de fiestas</Text>
              </TouchableOpacity>

              {/* Panel de analíticas */}
              {stats && (
                <View style={styles.statsPanel}>
                  <Text style={styles.statsTitle}>📊 En Folixa ahora mismo</Text>

                  <View style={styles.statsGrid}>
                    <View style={styles.statCard}>
                      <Text style={styles.statNum}>{stats.masAsistentes.asistentes || 0}</Text>
                      <Text style={styles.statLabel}>personas van a{'\n'}{stats.masAsistentes.nombre}</Text>
                    </View>
                    {stats.topConcejo && (
                      <View style={styles.statCard}>
                        <Text style={styles.statNum}>{stats.topConcejo[1]}</Text>
                        <Text style={styles.statLabel}>fiestas en{'\n'}{stats.topConcejo[0]}</Text>
                      </View>
                    )}
                  </View>

                  {stats.masVista && (stats.masVista.vistas || 0) > 0 && (
                    <TouchableOpacity
                      style={styles.topFiestaCard}
                      onPress={() => router.push({
                        pathname: '/detalle',
                        params: {
                          id: stats.masVista.id,
                          nombre: stats.masVista.nombre,
                          concejo: stats.masVista.concejo,
                          fecha: stats.masVista.fecha,
                          orquesta: stats.masVista.orquesta,
                          imagen: stats.masVista.imagen,
                          latitud: stats.masVista.ubicacion?.latitude,
                          longitud: stats.masVista.ubicacion?.longitude,
                          esVersity: stats.masVista.esVersity,
                          linkVersity: stats.masVista.linkVersity,
                        },
                      })}
                    >
                      <Text style={styles.topFiestaLabel}>🔥 La más vista</Text>
                      <Text style={styles.topFiestaNombre}>{stats.masVista.nombre}</Text>
                      <Text style={styles.topFiestaInfo}>
                        {stats.masVista.concejo} · {stats.masVista.vistas} visitas
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
              )}

              {/* ACTIVIDAD DE AMIGOS */}
              {actividadAmigos.length > 0 && (
                <View style={styles.statsPanel}>
                  <Text style={styles.statsTitle}>👥 Tus amigos van a...</Text>
                  {actividadAmigos.map(({ fiesta, nombres }) => {
                    const texto = nombres.length === 1
                      ? `${nombres[0]} irá`
                      : nombres.length === 2
                        ? `${nombres[0]} y ${nombres[1]} irán`
                        : `${nombres[0]} y ${nombres.length - 1} amigos más irán`;
                    return (
                      <TouchableOpacity
                        key={fiesta.id}
                        style={styles.amigoFiestaCard}
                        onPress={() => router.push({
                          pathname: '/detalle',
                          params: {
                            id: fiesta.id,
                            nombre: fiesta.nombre,
                            concejo: fiesta.concejo,
                            fecha: fiesta.fecha,
                            orquesta: fiesta.orquesta,
                            imagen: fiesta.imagen,
                            latitud: fiesta.ubicacion?.latitude,
                            longitud: fiesta.ubicacion?.longitude,
                          },
                        })}
                      >
                        <Text style={styles.amigoFiestaTexto}>{texto}</Text>
                        <Text style={styles.amigoFiestaNombre}>{fiesta.nombre}</Text>
                        <Text style={styles.amigoFiestaInfo}>{fiesta.concejo}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}
            </ScrollView>
          </SafeAreaView>
        </View>
      </ImageBackground>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  backgroundImage: { flex: 1, width: '100%', height: '100%' },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)' },
  content: { flex: 1 },
  scroll: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', padding: 20, paddingBottom: 40 },
  header: { alignItems: 'center', marginBottom: 30 },
  logoEmoji: { fontSize: 80 },
  titulo: {
    fontSize: 36, fontWeight: 'bold', color: '#fff', textAlign: 'center',
    textShadowColor: 'rgba(0,0,0,0.75)', textShadowOffset: { width: -1, height: 1 }, textShadowRadius: 10,
  },
  subtitulo: {
    fontSize: 20, fontWeight: '600', color: '#fbbf24', marginTop: 8, textAlign: 'center',
  },
  boton: {
    paddingVertical: 18, paddingHorizontal: 60, borderRadius: 30,
    elevation: 5, shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 5, shadowOffset: { width: 0, height: 3 },
  },
  textoBoton: { fontWeight: 'bold', fontSize: 18, letterSpacing: 1 },
  botonLista: {
    marginTop: 14, paddingVertical: 12, paddingHorizontal: 30,
    borderRadius: 20, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.5)',
  },
  textoBotonLista: { color: 'white', fontWeight: '600', fontSize: 15 },
  statsPanel: {
    marginTop: 30, width: '100%',
    backgroundColor: 'rgba(0,0,0,0.45)',
    borderRadius: 20, padding: 18,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)',
  },
  statsTitle: { color: 'white', fontWeight: 'bold', fontSize: 16, marginBottom: 14, textAlign: 'center' },
  statsGrid: { flexDirection: 'row', justifyContent: 'space-between', gap: 8, marginBottom: 14 },
  statCard: {
    flex: 1, backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: 14, padding: 12, alignItems: 'center',
  },
  statNum: { color: '#fbbf24', fontSize: 26, fontWeight: 'bold' },
  statLabel: { color: 'rgba(255,255,255,0.85)', fontSize: 11, textAlign: 'center', marginTop: 4, lineHeight: 15 },
  topFiestaCard: {
    backgroundColor: 'rgba(245,158,11,0.2)', borderRadius: 14,
    padding: 14, borderWidth: 1, borderColor: 'rgba(245,158,11,0.4)',
  },
  topFiestaLabel: { color: '#fbbf24', fontWeight: 'bold', fontSize: 13, marginBottom: 4 },
  topFiestaNombre: { color: 'white', fontWeight: 'bold', fontSize: 17 },
  topFiestaInfo: { color: 'rgba(255,255,255,0.7)', fontSize: 13, marginTop: 3 },
  amigoFiestaCard: {
    backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 14,
    padding: 14, marginTop: 8,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)',
  },
  amigoFiestaTexto: { color: 'rgba(255,255,255,0.7)', fontSize: 13, marginBottom: 4 },
  amigoFiestaNombre: { color: 'white', fontWeight: 'bold', fontSize: 16 },
  amigoFiestaInfo: { color: 'rgba(255,255,255,0.55)', fontSize: 12, marginTop: 2 },
});
