import ColorPicker, { HueSlider, Panel1, Preview } from 'reanimated-color-picker';
import { useCallback } from 'react';
import { runOnJS } from 'react-native-reanimated';
import { ScrollView, StyleSheet, Switch, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useConfig } from '../../contexts/ConfigContext';

export default function Configuracion() {
  const {
    theme, setTheme,
    primaryColor, setPrimaryColor,
    emojiFiesta, setEmojiFiesta,
    textColor,
  } = useConfig();

  const isDark = theme === 'dark';

  const coloresRapidos = [
    '#166534', '#059669', '#0284c7', '#2563eb',
    '#dc2626', '#e11d48', '#d97706', '#ea580c',
    '#5c2c84', '#7c3aed', '#db2777', '#475569',
  ];

  const emojis = ['⛺', '🎪', '🍻', '🌳', '🎉', '💃', '🎶', '🍎'];

  const applyColor = useCallback((hex) => {
    setPrimaryColor(hex);
  }, [setPrimaryColor]);

  const onColorComplete = useCallback(({ hex }) => {
    'worklet';
    runOnJS(applyColor)(hex);
  }, [applyColor]);

  return (
    <SafeAreaView style={[styles.container, isDark && styles.containerDark]}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={[styles.title, { color: primaryColor }]}>Configuración</Text>

        {/* MODO OSCURO */}
        <View style={[styles.section, styles.rowSection, isDark && styles.sectionDark]}>
          <Text style={[styles.label, isDark && styles.textDark, { marginBottom: 0 }]}>Modo oscuro</Text>
          <Switch
            value={isDark}
            onValueChange={(val) => setTheme(val ? 'dark' : 'light')}
            trackColor={{ false: '#767577', true: primaryColor }}
            thumbColor={'#f4f3f4'}
          />
        </View>

        {/* COLOR PRINCIPAL */}
        <View style={[styles.section, isDark && styles.sectionDark]}>
          <Text style={[styles.label, isDark && styles.textDark]}>Color principal</Text>

          {/* Colores rápidos */}
          <Text style={[styles.subLabel, isDark && styles.subTextDark]}>Colores rápidos</Text>
          <View style={styles.optionsRow}>
            {coloresRapidos.map((color) => (
              <TouchableOpacity
                key={color}
                style={[
                  styles.colorCircle,
                  { backgroundColor: color },
                  primaryColor === color && [styles.selectedCircle, isDark && styles.selectedCircleDark],
                ]}
                onPress={() => setPrimaryColor(color)}
              />
            ))}
          </View>

          {/* Picker libre */}
          <Text style={[styles.subLabel, isDark && styles.subTextDark, { marginTop: 18 }]}>
            O elige un color personalizado
          </Text>
          <ColorPicker
            value={primaryColor}
            onComplete={onColorComplete}
            style={styles.colorPicker}
          >
            <Preview style={styles.pickerPreview} />
            <Panel1 style={styles.pickerPanel} />
            <HueSlider style={styles.pickerSlider} />
          </ColorPicker>

          {/* Vista previa de contraste */}
          <View style={[styles.contrastePreview, { backgroundColor: primaryColor }]}>
            <Text style={[styles.contrasteTexto, { color: textColor }]}>
              Así se verá el texto sobre tu color
            </Text>
          </View>
        </View>

        {/* EMOJI DE FIESTAS */}
        <View style={[styles.section, isDark && styles.sectionDark]}>
          <Text style={[styles.label, isDark && styles.textDark]}>Emoji de las fiestas</Text>
          <View style={styles.optionsRow}>
            {emojis.map((emoji) => (
              <TouchableOpacity
                key={emoji}
                style={[
                  styles.emojiButton,
                  isDark && styles.emojiButtonDark,
                  emojiFiesta === emoji && { borderColor: primaryColor, backgroundColor: isDark ? '#333' : '#f0fdf4' },
                ]}
                onPress={() => setEmojiFiesta(emoji)}
              >
                <Text style={styles.emojiText}>{emoji}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f4f4f4' },
  containerDark: { backgroundColor: '#121212' },
  content: { padding: 20 },
  title: { fontSize: 28, fontWeight: 'bold', marginBottom: 30, textAlign: 'center' },
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
  sectionDark: { backgroundColor: '#1e1e1e', shadowOpacity: 0.3 },
  rowSection: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  label: { fontSize: 16, fontWeight: '600', color: '#333', marginBottom: 10 },
  textDark: { color: '#ddd' },
  subLabel: { fontSize: 13, color: '#888', marginBottom: 10 },
  subTextDark: { color: '#777' },
  optionsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 15 },
  colorCircle: { width: 40, height: 40, borderRadius: 20 },
  selectedCircle: { borderWidth: 3, borderColor: '#000' },
  selectedCircleDark: { borderColor: '#fff' },
  colorPicker: { marginTop: 5 },
  pickerPreview: { height: 40, borderRadius: 10, marginBottom: 12 },
  pickerPanel: { borderRadius: 10, marginBottom: 12, height: 160 },
  pickerSlider: { borderRadius: 8, height: 30 },
  contrastePreview: {
    marginTop: 14,
    padding: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  contrasteTexto: { fontWeight: 'bold', fontSize: 15 },
  emojiButton: {
    padding: 10, borderRadius: 10, borderWidth: 2,
    borderColor: 'transparent', backgroundColor: '#f9f9f9',
  },
  emojiButtonDark: { backgroundColor: '#2c2c2c' },
  emojiText: { fontSize: 24 },
});
