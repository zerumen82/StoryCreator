import { create } from 'zustand'
import * as db from '../db/repositories'

interface Memory {
  id: string
  type: 'preference' | 'feedback' | 'context' | 'character_note' | 'story_element' | 'user_message' | 'ai_response' | 'ai_stream_chunk'
  content: string
  relevance: number
  createdAt: number
}

interface MemoryState {
  memories: Memory[]
  loading: boolean
  init: () => void
  addMemory: (type: Memory['type'], content: string, relevance?: number) => void
  getMemoriesByType: (type: Memory['type']) => Memory[]
  getRelevantContext: (type: Memory['type'], limit?: number) => string[]
  deleteMemory: (id: string) => void
  clearOldMemories: (daysToKeep?: number) => void
}

export const useMemoryStore = create<MemoryState>((set, get) => ({
  memories: [],
  loading: false,

  init: () => {
    set({ loading: true })
    const rows = db.getAllMemories()
    const memories: Memory[] = rows.map(row => ({
      id: row.id,
      type: row.type as Memory['type'],
      content: row.content,
      relevance: row.relevance,
      createdAt: row.created_at
    }))
    set({ memories, loading: false })
  },

  addMemory: (type, content, relevance = 1.0) => {
    const id = db.addMemory(type, content, relevance)
    const memory: Memory = { id, type, content, relevance, createdAt: Date.now() }
    set((state) => ({ memories: [memory, ...state.memories] }))
  },

  getMemoriesByType: (type) => {
    return get().memories.filter(m => m.type === type)
  },

  getRelevantContext: (type, limit = 10) => {
    return get().memories
      .filter(m => m.type === type)
      .sort((a, b) => b.relevance - a.relevance)
      .slice(0, limit)
      .map(m => m.content)
  },

  deleteMemory: (id) => {
    db.deleteMemory(id)
    set((state) => ({
      memories: state.memories.filter(m => m.id !== id)
    }))
  },

  clearOldMemories: (daysToKeep = 30) => {
    const cutoff = Date.now() - (daysToKeep * 24 * 60 * 60 * 1000)
    const oldMemories = get().memories.filter(m => m.createdAt < cutoff)
    oldMemories.forEach(m => db.deleteMemory(m.id))
    set((state) => ({
      memories: state.memories.filter(m => m.createdAt >= cutoff)
    }))
  }
}))