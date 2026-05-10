import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Dimensions, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const { width } = Dimensions.get('window');

const SLIDES = [
  {
    id: '1',
    emoji: '🎪',
    title: 'Bienvenido a Folixa',
    desc: 'Descubre todas las fiestas y folixas de Asturias en un solo lugar.',
    bg: '#166534',
    accent: '#bbf7d0',
  },
  {
    id: '2',
    emoji: '🗺️',
    title: 'Encuentra tu folixa',
    desc: 'Mapa interactivo con todas las fiestas cerca de ti. Filtra por concejo, fecha u orquesta.',
    bg: '#1d4ed8',
    accent: '#bfdbfe',
  },
  {
    id: '3',
    emoji: '🔔',
    title: 'No te pierdas nada',
    desc: 'Guarda tus fiestas favoritas y recibe notificaciones antes de que empiece la folixa.',
    bg: '#7c3aed',
    accent: '#ede9fe',
  },
  {
    id: '4',
    emoji: '🏆',
    title: 'Únete a la comunidad',
    desc: 'Sigue a tus amigos, sube fotos y desbloquea logros asistiendo a las mejores folixas.',
    bg: '#b45309',
    accent: '#fef3c7',
  },
];

export default function Onboarding() {
  const router = useRouter();
  const [idx, setIdx] = useState(0);
  const slide = SLIDES[idx];

  const completar = async () => {
    await AsyncStorage.setItem('@folixa_onboarding_done', 'true');
    router.replace('/auth/login');
  };

  const siguiente = () => {
    if (idx < SLIDES.length - 1) setIdx(i => i + 1);
    else completar();
  };

  const anterior = () => setIdx(i => i - 1);

  return (
    <View style={[styles.container, { backgroundColor: slide.bg }]}>
      <SafeAreaView style={styles.safe}>

        <TouchableOpacity style={styles.btnSkip} onPress={completar}>
          <Text style={styles.skipTxt}>Omitir</Text>
        </TouchableOpacity>

        <View style={styles.slide}>
          <Text style={styles.emoji}>{slide.emoji}</Text>
          <Text style={styles.title}>{slide.title}</Text>
          <Text style={styles.desc}>{slide.desc}</Text>
        </View>

        <View style={styles.dots}>
          {SLIDES.map((_, i) => (
            <View
              key={i}
              style={[styles.dot, i === idx && { backgroundColor: 'white', width: 24 }]}
            />
          ))}
        </View>

        <View style={styles.btns}>
          {idx > 0 && (
            <TouchableOpacity style={styles.btnPrev} onPress={anterior}>
              <Text style={[styles.btnPrevTxt, { color: slide.accent }]}>← Anterior</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={[styles.btnNext, { flex: idx > 0 ? undefined : 1 }]}
            onPress={siguiente}
          >
            <Text style={[styles.btnNextTxt, { color: slide.bg }]}>
              {idx === SLIDES.length - 1 ? '¡Empezar!' : 'Siguiente →'}
            </Text>
          </TouchableOpacity>
        </View>

      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safe: { flex: 1, paddingHorizontal: 28 },

  btnSkip: { alignSelf: 'flex-end', paddingTop: 16, paddingBottom: 8 },
  skipTxt: { color: 'rgba(255,255,255,0.65)', fontSize: 15 },

  slide: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: 20,
  },
  emoji: { fontSize: 96, marginBottom: 32 },
  title: {
    fontSize: 28, fontWeight: 'bold', color: 'white',
    textAlign: 'center', marginBottom: 18,
  },
  desc: {
    fontSize: 17, color: 'rgba(255,255,255,0.85)',
    textAlign: 'center', lineHeight: 26,
  },

  dots: {
    flexDirection: 'row', justifyContent: 'center',
    alignItems: 'center', gap: 8, paddingBottom: 24,
  },
  dot: {
    width: 8, height: 8, borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.35)',
  },

  btns: {
    flexDirection: 'row', gap: 12, paddingBottom: 28,
  },
  btnPrev: {
    flex: 1, padding: 18, borderRadius: 16,
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  btnPrevTxt: { fontSize: 16, fontWeight: '600' },
  btnNext: {
    flex: 1, backgroundColor: 'white',
    padding: 18, borderRadius: 16, alignItems: 'center',
  },
  btnNextTxt: { fontSize: 17, fontWeight: 'bold' },
});
