import { APP_NAME } from './appInfo.ts'

// Página mínima da Etapa 0. O layout real (mapa, painel, controlos) chega na Etapa 1.
export function App() {
  return (
    <main className="placeholder">
      <h1>{APP_NAME}</h1>
      <p>Plataforma de simulação de redes de portagens — em construção.</p>
      <p className="note">
        Rede esquemática de demonstração. Os resultados serão estimativas de um modelo, não dados
        oficiais.
      </p>
    </main>
  )
}
