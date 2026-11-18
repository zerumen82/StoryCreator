import { create } from 'zustand'
import * as db from '../db/repositories'

interface RelationshipStore {
  relationships: db.Relationship[]
  init: () => void
  addRelationship: (data: { characterId1: string; characterId2: string; type: string; subtype: string; description?: string; strength?: number }) => boolean
  updateRelationship: (id: string, data: Partial<{ characterId1: string; characterId2: string; type: string; subtype: string; description: string; strength: number }>) => boolean
  deleteRelationship: (id: string) => boolean
  getCharacterRelationships: (characterId: string) => db.Relationship[]
  getRelationship: (id: string) => db.Relationship | null
  getRelationshipByPair: (id1: string, id2: string, type: string, subtype: string) => db.Relationship | null
  getCharacterRelationshipStats: (characterId: string) => { familyCount: number; affinityCount: number; totalStrength: number; averageStrength: number }
  hasRelationship: (id1: string, id2: string, type: string) => boolean
}

export const useRelationshipStore = create<RelationshipStore>((set, get) => ({
  relationships: [],

  init: () => {
    set({ relationships: db.getAllRelationships() })
  },

  addRelationship: (data) => {
    try {
      // evitar duplicados exactos
      const existing = get().relationships.find(
        r => r.characterId1 === data.characterId1 && r.characterId2 === data.characterId2 &&
          r.type === data.type && r.subtype === data.subtype
      )
      if (existing) return false
      const rel = db.addRelationship(data)
      set(state => ({ relationships: [rel, ...state.relationships] }))
      return true
    } catch (err) {
      console.error('Error adding relationship:', err)
      return false
    }
  },

  updateRelationship: (id, data) => {
    try {
      db.updateRelationship(id, data)
      set(state => ({
        relationships: state.relationships.map(r => (r.id === id ? { ...r, ...data, updatedAt: Date.now() } as db.Relationship : r)),
      }))
      return true
    } catch (err) {
      console.error('Error updating relationship:', err)
      return false
    }
  },

  deleteRelationship: (id) => {
    try {
      db.deleteRelationship(id)
      set(state => ({ relationships: state.relationships.filter(r => r.id !== id) }))
      return true
    } catch (err) {
      console.error('Error deleting relationship:', err)
      return false
    }
  },

  getCharacterRelationships: (characterId) => {
    return get().relationships.filter(r => r.characterId1 === characterId || r.characterId2 === characterId)
  },

  getRelationship: (id) => {
    return get().relationships.find(r => r.id === id) || null
  },

  getRelationshipByPair: (id1, id2, type, subtype) => {
    return get().relationships.find(r => r.characterId1 === id1 && r.characterId2 === id2 && r.type === type && r.subtype === subtype) || null
  },

  getCharacterRelationshipStats: (characterId) => {
    const rows = get().relationships.filter(r => r.characterId1 === characterId || r.characterId2 === characterId)
    const stats = { familyCount: 0, affinityCount: 0, totalStrength: 0, averageStrength: 0 }
    for (const row of rows) {
      stats.totalStrength += row.strength || 0
      if (row.type === 'parentesco') stats.familyCount += 1
      else stats.affinityCount += 1
    }
    const totalCount = stats.familyCount + stats.affinityCount
    stats.averageStrength = totalCount > 0 ? stats.totalStrength / totalCount : 0
    return stats
  },

  hasRelationship: (id1, id2, type) => {
    return get().relationships.some(r => (r.characterId1 === id1 && r.characterId2 === id2 || r.characterId1 === id2 && r.characterId2 === id1) && r.type === type)
  },
}))
