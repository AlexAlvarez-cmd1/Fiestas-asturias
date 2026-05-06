import { Stack } from 'expo-router';

export default function RootLayout() {
  return (
    <Stack>
      {/* Carga el grupo de pestañas por defecto */}
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      
      {/* Pantallas que se abren encima (sin pestañas abajo) */}
      <Stack.Screen name="detalle" options={{ title: 'Detalles' }} />
      <Stack.Screen name="nueva" options={{ title: 'Añadir Fiesta' }} />
      <Stack.Screen name="editar" options={{ title: 'Editar Fiesta' }} />
    </Stack>
  );
}