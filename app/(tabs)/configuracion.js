import { useState } from 'react';
import { Modal, ScrollView, StyleSheet, Switch, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaView } from 'react-native-safe-area-context';
import ColorPicker, { HueSlider, Panel1, Preview } from 'reanimated-color-picker';
import { useConfig } from '../../contexts/ConfigContext';

export default function Configuracion() {
  const { 
    username, setUsername, 
    theme, setTheme, 
    primaryColor, setPrimaryColor, 
    emojiFiesta, setEmojiFiesta 
  } = useConfig();

  const isDark = theme === 'dark';

  const [modalColorVisible, setModalColorVisible] = useState(false);
  const [customColor, setCustomColor] = useState('#166534');

  const colores = ['#166534', '#0284c7', '#dc2626', '#d97706', '#5c2c84'];
  const emojis = ['⛺', '🎪', '🍻', '🌳', '🎉', '💃'];

  const abrirModalColor = () => {
    if (primaryColor && primaryColor.startsWith('#') && primaryColor.length === 7) {
      setCustomColor(primaryColor);
    } else {
      setCustomColor('#166534');
    }
    setModalColorVisible(true);
  };

  const guardarColorPersonalizado = () => {
    setPrimaryColor(customColor);
    setModalColorVisible(false);
  };

  const getContrastColor = (hex) => {
    if (!hex || hex.length !== 7) return '#ffffff';
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b);
    return luminance > 128 ? '#000000' : '#ffffff';
  };

  const textColor = getContrastColor(customColor);

  return (
    <SafeAreaView style={[styles.container, isDark && styles.containerDark]}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={[styles.title, { color: primaryColor }]}>Configuración</Text>

        <View style={[styles.section, isDark && styles.sectionDark]}>
          <Text style={[styles.label, isDark && styles.textDark]}>Nombre de usuario</Text>
          <TextInput
            style={[styles.input, isDark && styles.inputDark]}
            value={username}
            onChangeText={setUsername}
            placeholder="¿Cómo te llamas?"
            placeholderTextColor={isDark ? '#aaa' : '#888'}
          />
        </View>

        <View style={[styles.section, styles.rowSection, isDark && styles.sectionDark]}>
          <Text style={[styles.label, isDark && styles.textDark, { marginBottom: 0 }]}>Modo oscuro</Text>
          <Switch
            value={isDark}
            onValueChange={(val) => setTheme(val ? 'dark' : 'light')}
            trackColor={{ false: '#767577', true: primaryColor }}
            thumbColor={'#f4f3f4'}
          />
        </View>

        <View style={[styles.section, isDark && styles.sectionDark]}>
          <Text style={[styles.label, isDark && styles.textDark]}>Color principal</Text>
          <View style={styles.optionsRow}>
            {colores.map((color) => (
              <TouchableOpacity
                key={color}
                style={[
                  styles.colorCircle,
                  { backgroundColor: color },
                  primaryColor === color && [styles.selectedCircle, isDark && styles.selectedCircleDark]
                ]}
                onPress={() => setPrimaryColor(color)}
              />
            ))}
            <TouchableOpacity
              style={[
                styles.colorCircle,
                { backgroundColor: '#eee', justifyContent: 'center', alignItems: 'center' },
                isDark && { backgroundColor: '#333' },
                !colores.includes(primaryColor) && [styles.selectedCircle, isDark && styles.selectedCircleDark, { backgroundColor: primaryColor }]
              ]}
              onPress={abrirModalColor}
            >
              <Text style={{ fontSize: 20, color: isDark ? '#fff' : '#000' }}>+</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={[styles.section, isDark && styles.sectionDark]}>
          <Text style={[styles.label, isDark && styles.textDark]}>Emoji de las fiestas</Text>
          <View style={styles.optionsRow}>
            {emojis.map((emoji) => (
              <TouchableOpacity
                key={emoji}
                style={[
                  styles.emojiButton,
                  isDark && styles.emojiButtonDark,
                  emojiFiesta === emoji && { borderColor: primaryColor, backgroundColor: isDark ? '#333' : '#f0fdf4' }
                ]}
                onPress={() => setEmojiFiesta(emoji)}
              >
                <Text style={styles.emojiText}>{emoji}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

      </ScrollView>

      <Modal
        visible={modalColorVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setModalColorVisible(false)}
      >
        <GestureHandlerRootView style={styles.modalFondo}>
          <View style={[styles.modalContenido, isDark && styles.modalContenidoDark]}>
            <Text style={[styles.modalTitulo, isDark && styles.textDark]}>Crea tu color</Text>
            
            <ColorPicker
              style={{ width: '100%', gap: 20, marginBottom: 20 }}
              value={customColor}
              onChange={(color) => setCustomColor(color.hex)}
            >
              <Preview 
                style={[styles.colorPreview, { alignSelf: 'center' }]} 
                textStyle={{ fontSize: 16, fontWeight: 'bold' }} 
              />
              <Panel1 style={{ width: '100%', height: 200, borderRadius: 10 }} />
              <HueSlider style={{ width: '100%', height: 30, borderRadius: 15 }} />
            </ColorPicker>

            <View style={styles.modalBotones}>
              <TouchableOpacity style={styles.btnCancelar} onPress={() => setModalColorVisible(false)}>
                <Text style={styles.textoBtnCancelar}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.btnGuardar, { backgroundColor: customColor }]} 
                onPress={guardarColorPersonalizado}
              >
                <Text style={[styles.textoBtnGuardar, { color: textColor }]}>Aplicar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </GestureHandlerRootView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f4f4f4',
  },
  containerDark: {
    backgroundColor: '#121212',
  },
  content: {
    padding: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 30,
    textAlign: 'center',
  },
  section: {
    marginBottom: 25,
    backgroundColor: 'white',
    padding: 15,
    borderRadius: 15,
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 2 },
  },
  sectionDark: {
    backgroundColor: '#1e1e1e',
    shadowColor: '#000',
    shadowOpacity: 0.3,
  },
  rowSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 10,
  },
  textDark: {
    color: '#ddd',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 10,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#fafafa',
  },
  inputDark: {
    backgroundColor: '#1e1e1e',
    borderColor: '#444',
    color: '#fff',
  },
  optionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 15,
  },
  colorCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  selectedCircle: {
    borderWidth: 3,
    borderColor: '#000',
  },
  selectedCircleDark: {
    borderColor: '#fff',
  },
  emojiButton: {
    padding: 10,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: 'transparent',
    backgroundColor: '#f9f9f9',
  },
  emojiButtonDark: {
    backgroundColor: '#2c2c2c',
  },
  emojiText: {
    fontSize: 24,
  },
  modalFondo: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContenido: {
    backgroundColor: 'white',
    padding: 25,
    borderRadius: 20,
    width: '85%',
    alignItems: 'center',
  },
  modalContenidoDark: {
    backgroundColor: '#1e1e1e',
  },
  modalTitulo: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 15,
    color: '#333',
  },
  colorPreview: {
    width: 100,
    height: 100,
    borderRadius: 50,
    marginBottom: 10,
    borderWidth: 2,
    borderColor: '#ddd',
    overflow: 'hidden'
  },
  modalBotones: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    marginTop: 10,
  },
  btnCancelar: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 10,
    backgroundColor: '#f1f5f9',
    flex: 1,
    marginRight: 10,
    alignItems: 'center',
  },
  textoBtnCancelar: {
    color: '#64748b',
    fontWeight: 'bold',
  },
  btnGuardar: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 10,
    flex: 1,
    marginLeft: 10,
    alignItems: 'center',
  },
  textoBtnGuardar: {
    fontWeight: 'bold',
  },
});
