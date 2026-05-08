import { Tabs } from 'expo-router';
import { Text } from 'react-native';
import { useConfig } from '../../contexts/ConfigContext';

export default function TabLayout() {
  const { primaryColor, theme } = useConfig();
  const isDark = theme === 'dark';

  return (
    <Tabs screenOptions={{
      tabBarActiveTintColor: primaryColor,
      tabBarInactiveTintColor: isDark ? '#888' : '#8e8e93',
      headerShown: false,
      tabBarStyle: {
        backgroundColor: isDark ? '#121212' : '#ffffff',
        borderTopColor: isDark ? '#222' : '#e5e5e5',
      },
    }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Inicio',
          tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 20 }}>🏠</Text>,
        }}
      />

      <Tabs.Screen
        name="lista"
        options={{
          title: 'Lista',
          tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 20 }}>📋</Text>,
        }}
      />
            <Tabs.Screen
        name="mapa"
        options={{
          title: 'Explorar',
          tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 20 }}>📍</Text>,
        }}
      />
      <Tabs.Screen
        name="perfil"
        options={{
          title: 'Perfil',
          tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 20 }}>👤</Text>,
        }}
      />
      <Tabs.Screen
        name="configuracion"
        options={{
          title: 'Ajustes',
          tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 20 }}>⚙️</Text>,
        }}
      />
    </Tabs>
  );
}
