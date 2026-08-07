import { Stack } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { useFonts } from 'expo-font'
import { DMSans_400Regular, DMSans_500Medium, DMSans_600SemiBold, DMSans_700Bold } from '@expo-google-fonts/dm-sans'
import { InstrumentSerif_400Regular } from '@expo-google-fonts/instrument-serif'
import { View, ActivityIndicator } from 'react-native'
import { AuthProvider } from '@/lib/auth'
import { AluProvider } from '@/components/alu'
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
        <AluProvider>
          <StatusBar style="light" />
          <Stack screenOptions={{ headerShown: false, animation: 'fade' }}>
            <Stack.Screen name="index" />
            <Stack.Screen name="login" />
            <Stack.Screen name="bem-vindo" />
            <Stack.Screen name="proprietario" />
            <Stack.Screen name="rentabilidade" />
            <Stack.Screen name="historico" />
            <Stack.Screen name="equipe" />
          <Stack.Screen name="equipe/mais" />
          <Stack.Screen name="equipe/custos" />
          <Stack.Screen name="equipe/diarias" />
          <Stack.Screen name="equipe/reservas" />
          <Stack.Screen name="equipe/empreendimentos" />
          <Stack.Screen name="equipe/custos-operacionais" />
          <Stack.Screen name="equipe/manual" />
          <Stack.Screen name="equipe/relatorio" />
          <Stack.Screen name="equipe/desempenho" />
          <Stack.Screen name="equipe/prestacao-contas" />
          <Stack.Screen name="equipe/usuarios" />
          </Stack>
        </AluProvider>
      </AuthProvider>
    </SafeAreaProvider>
  )
}
