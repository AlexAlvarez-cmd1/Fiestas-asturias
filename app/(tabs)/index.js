import { useRouter } from 'expo-router';
import { ImageBackground, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useConfig } from '../../contexts/ConfigContext';

// URL de imagen de ejemplo (un prao festivo nocturno)
// Puedes cambiar esta URL por una foto de Asturias o una local
const fondoImagen = { uri: 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/3e/Flag_of_Asturias.svg/1280px-Flag_of_Asturias.svg.png' };

export default function PantallaHome() {
  const router = useRouter();
  const { emojiFiesta, primaryColor } = useConfig();

  return (
    <View style={styles.container}>
      {/* Configuramos la barra de estado para que se vea blanca sobre el fondo oscuro */}
      <StatusBar barStyle="light-content" />
      
      <ImageBackground 
        source={fondoImagen} 
        style={styles.backgroundImage}
        resizeMode="cover"
      >
        {/* Capa traslúcida oscura (Overlay) para mejorar la legibilidad del texto */}
        <View style={styles.overlay}>
          
          <SafeAreaView style={styles.content}>
            
            {/* Cabecera con Logo y Título */}
            <View style={styles.header}>
              <Text style={styles.logoEmoji}>{emojiFiesta}</Text>
              <Text style={styles.titulo}>Fiestas de prao</Text>
            </View>

            {/* Texto descriptivo - Ahora en blanco */}
            <View style={styles.textContainer}>
              <Text style={styles.subtitulo}>Encuentra folixa cerca de ti</Text>
            </View>

            {/* Botón clásico - Mantenemos el estilo anterior */}
            <TouchableOpacity 
              style={[styles.boton, { backgroundColor: primaryColor }]} 
              onPress={() => router.push('/mapa')}
            >
              <Text style={styles.textoBoton}>IR AL MAPA</Text>
            </TouchableOpacity>

          </SafeAreaView>
        </View>
      </ImageBackground>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  backgroundImage: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)', // Negro con 50% de opacidad
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    width: '100%',
  },
  header: {
    alignItems: 'center',
    marginBottom: 30,
  },
  logoEmoji: {
    fontSize: 80,
  },
  titulo: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#fff', // Texto en blanco
    textAlign: 'center',
    textShadowColor: 'rgba(0, 0, 0, 0.75)', // Sombra para mayor contraste
    textShadowOffset: {width: -1, height: 1},
    textShadowRadius: 10
  },
  textContainer: {
    alignItems: 'center',
    marginBottom: 60,
    paddingHorizontal: 20,
  },
  subtitulo: {
    fontSize: 22,
    fontWeight: '600',
    color: '#fbbf24', // Un amarillo/ámbar para destacar (color sidra)
    marginBottom: 15,
    textAlign: 'center',
  },
  descripcion: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.8)', // Blanco traslúcido
    textAlign: 'center',
    lineHeight: 24,
    fontWeight: '500',
  },
  boton: {
    backgroundColor: '#166534', // Verde Asturias
    paddingVertical: 18,
    paddingHorizontal: 60,
    borderRadius: 30,
    elevation: 5, // Sombra en Android
    shadowColor: '#000', // Sombra en iOS
    shadowOpacity: 0.3,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 3 },
  },
  textoBoton: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 18,
    letterSpacing: 1, // Espaciado entre letras
  },
});