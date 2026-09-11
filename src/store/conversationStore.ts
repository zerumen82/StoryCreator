import { create } from 'zustand'
import type { ChatMessage } from '../types'
import * as db from '../db/repositories'
import { useMemoryStore } from './memoryStore'

interface Conversation {
  id: string
  characterId: string | null
  title: string
  mode: 'chat' | 'story'
  createdAt: number
  updatedAt: number
}

interface ConversationState {
  conversations: Conversation[]
  currentConversationId: string | null
  messages: ChatMessage[]
  loading: boolean
  init: () => void
  createConversation: (characterId: string | null, mode: 'chat' | 'story') => string
  selectConversation: (id: string) => void
  deleteConversation: (id: string) => void
  addMessage: (role: 'user' | 'assistant' | 'system', content: string) => string
  updateMessageContent: (messageId: string, content: string) => void
  setFeedback: (messageId: string, feedback: number) => void
}

export const useConversationStore = create<ConversationState>((set, get) => ({
  conversations: [],
  currentConversationId: null,
  messages: [],
  loading: false,

  init: () => {
    set({ loading: true })
    const conversations = db.getAllConversations()
    set({ conversations, loading: false })
  },

  createConversation: (characterId, mode) => {
    const id = db.createConversation(characterId, mode)
    const conversation: Conversation = {
      id,
      characterId,
      title: mode === 'chat' ? 'Chat con personaje' : 'Nueva historia',
      mode,
      createdAt: Date.now(),
      updatedAt: Date.now()
    }
    set((state) => ({
      conversations: [conversation, ...state.conversations],
      currentConversationId: id,
      messages: []
    }))
    return id
  },

  selectConversation: (id) => {
    const messages = db.getMessagesByConversation(id)
    set({ currentConversationId: id, messages })
  },

  deleteConversation: (id) => {
    db.deleteConversation(id)
    set((state) => ({
      conversations: state.conversations.filter((c) => c.id !== id),
      currentConversationId: state.currentConversationId === id ? null : state.currentConversationId,
      messages: state.currentConversationId === id ? [] : state.messages
    }))
  },

  addMessage: (role, content) => {
    const { currentConversationId } = get()
    if (!currentConversationId) return ''
    const id = db.addMessage(currentConversationId, role, content)
    const message: ChatMessage = { id, role, content, timestamp: Date.now() }
    set((state) => ({ messages: [...state.messages, message] }))

    // Registrar en memoria para aprendizaje (solo mensajes de usuario e IA)
    if (role === 'user' || role === 'assistant') {
      const memoryStore = useMemoryStore.getState()
      memoryStore.addMemory(
        role === 'user' ? 'user_message' : 'ai_response',
        content,
        role === 'user' ? 0.8 : 1.0
      )
    }

    return id
  },

  updateMessageContent: (messageId, content) => {
    // Persistir el contenido final de un mensaje (p.ej. respuesta de IA al
    // terminar el streaming). Sin esto la BD guarda el texto vacio inicial.
    db.updateMessageContent(messageId, content)
    set((state) => ({
      messages: state.messages.map((m) => (m.id === messageId ? { ...m, content } : m)),
    }))
  },

  setFeedback: (messageId, feedback) => {
    db.setMessageFeedback(messageId, feedback)
  }
}))