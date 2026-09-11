import { create } from 'zustand'
import type { Character } from '../types'
import * as db from '../db/repositories'

const USER_KEY = 'storycreator-user-character-id'

interface CharacterState {
  characters: Character[]
  userCharacterId: string | null
  loading: boolean
  init: () => void
  addCharacter: (character: Omit<Character, 'id' | 'createdAt' | 'updatedAt'>) => Character
  updateCharacter: (id: string, data: Partial<Character>) => void
  deleteCharacter: (id: string) => void
  getCharacter: (id: string) => Character | undefined
  getUserCharacter: () => Character | null
  setUserCharacter: (id: string) => void
  clearUserCharacter: () => void
  isUserCharacter: (id: string) => boolean
}

export const useCharacterStore = create<CharacterState>((set, get) => ({
  characters: [],
  userCharacterId: typeof localStorage !== 'undefined' ? localStorage.getItem(USER_KEY) : null,
  loading: false,

  init: () => {
    set({ loading: true })
    const characters = db.getAllCharacters()
    // Si el personaje usuario ya no existe, limpiar la marca
    let userCharacterId = localStorage.getItem(USER_KEY)
    if (userCharacterId && !characters.some((c) => c.id === userCharacterId)) {
      localStorage.removeItem(USER_KEY)
      userCharacterId = null
    }
    set({ characters, userCharacterId, loading: false })
  },

  addCharacter: (data) => {
    const character = db.createCharacter(data)
    set((state) => ({ characters: [character, ...state.characters] }))
    return character
  },

  updateCharacter: (id, data) => {
    db.updateCharacter(id, data)
    set((state) => ({
      characters: state.characters.map((c) =>
        c.id === id ? { ...c, ...data } : c
      ),
    }))
  },

  deleteCharacter: (id) => {
    // Prevent deleting user character
    if (get().userCharacterId === id) {
      console.error('No se puede borrar el personaje usuario')
      return
    }
    db.deleteCharacter(id)
    set((state) => ({
      characters: state.characters.filter((c) => c.id !== id),
    }))
  },

  getCharacter: (id) => {
    return get().characters.find((c) => c.id === id)
  },

  getUserCharacter: () => {
    const storedId = get().userCharacterId
    if (!storedId) return null
    return get().characters.find((c) => c.id === storedId) || null
  },

  setUserCharacter: (id: string) => {
    localStorage.setItem(USER_KEY, id)
    set({ userCharacterId: id })
  },

  clearUserCharacter: () => {
    localStorage.removeItem(USER_KEY)
    set({ userCharacterId: null })
  },

  isUserCharacter: (id: string) => {
    return get().userCharacterId === id
  },
}))
