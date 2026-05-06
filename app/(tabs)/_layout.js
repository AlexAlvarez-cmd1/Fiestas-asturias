import { Tabs } from 'expo-router';
import { Text } from 'react-native';

export default function TabLayout() {
  return (
    <Tabs screenOptions={{ 
      tabBarActiveTintColor: '#166534',
      headerShown: false 
    }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Inicio',
          tabBarIcon: ({ color }) => <Text style={{color, fontSize: 20}}>🏠</Text>,
        }}
      />
      <Tabs.Screen
        name="mapa"
        options={{
          title: 'Explorar',
          tabBarIcon: ({ color }) => <Text style={{color, fontSize: 20}}>📍</Text>,
        }}
      />
    </Tabs>
  );
}