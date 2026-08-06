import { Stack } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { useFonts } from 'expo-font'
import { DMSans_400Regular, DMSans_500Medium, DMSans_600SemiBold, DMSans_700Bold } from '@expo-google-fonts/dm-sans'
import { InstrumentSerif_400Regular } from '@expo-google-fonts/instrument-serif'
import { View, ActivityIndicator } from 'react-native'
import { AuthProvider } from '@/lib/auth'
import { CORES } from '@/constants/tema'

export default function RootLayout() {
  // As mesmas famílias do portal web: DM Sans no corpo, Instrument Serif na
  // saudação. Sem elas o app cai na fonte do sistema e deixa de parecer o
  // mesmo produto.
  const [fontesProntas] = useFonts({
    DMSans_400Regular,
    DMSans_500Medium,
    DMSans_600SemiBold,
    DMSans_700Bold,
    InstrumentSerif_400Regular,
  })

  if (!fontesProntas) {
    return (
      <View style={{ flex: 1, backgroundColor: CORES.azul, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color="#fff" />
      </View>
    )
  }

  return (
    <SafeAreaProvider>
      <AuthProvider>
        <StatusBar style="light" />
        <Stack screenOptions={{ headerShown: false, animation: 'fade' }}>
          <Stack.Screen name="index" />
          <Stack.Screen name="login" />
          <Stack.Screen name="proprietario" />
          <Stack.Screen name="rentabilidade" />
          <Stack.Screen name="historico" />
          <Stack.Screen name="equipe" />
        </Stack>
      </AuthProvider>
    </SafeAreaProvider>
  )
}
