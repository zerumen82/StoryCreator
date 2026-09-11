import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { ChatMessage } from '../types'
import { v4 as uuidv4 } from 'uuid'

interface ChatState {
  messages: ChatMessage[]
  isGenerating: boolean
  addMessage: (message: Omit<ChatMessage, 'id' | 'timestamp'>) => string
  clearMessages: () => void
  setGenerating: (isGenerating: boolean) => void
}

export const useChatStore = create<ChatState>()(
  persist(
    (set, get) => ({
      messages: [],
      isGenerating: false,
      addMessage: (message) => {
        const id = uuidv4()
        set({
          messages: [
            ...get().messages,
            { ...message, id, timestamp: Date.now() },
          ],
        })
        return id
      },
      clearMessages: () => set({ messages: [] }),
      setGenerating: (isGenerating) => set({ isGenerating }),
    }),
    {
      name: 'storycreator-chat',
      // isGenerating jamas se persiste: si la app se cerro generando,
      // al reabrir quedaba bloqueado y Enviar no hacia nada.
      partialize: (state) => ({ messages: state.messages }) as ChatState,
    }
  )
)

// Seguridad extra: al arrancar, nunca quedarse en "generando"
try {
  useChatStore.setState({ isGenerating: false })
} catch {
  // store aun no listo
}
