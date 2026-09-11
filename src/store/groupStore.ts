import { create } from 'zustand'
import type { Group } from '../types'
import * as db from '../db/repositories'

interface GroupState {
  groups: Group[]
  loading: boolean
  init: () => void
  addGroup: (group: Omit<Group, 'id' | 'createdAt' | 'updatedAt'>) => Group
  updateGroup: (id: string, data: Partial<Group>) => void
  deleteGroup: (id: string) => void
  getGroup: (id: string) => Group | undefined
}

export const useGroupStore = create<GroupState>((set, get) => ({
  groups: [],
  loading: false,

  init: () => {
    set({ loading: true })
    const groups = db.getAllGroups()
    set({ groups, loading: false })
  },

  addGroup: (data) => {
    const group = db.createGroup(data)
    set((state) => ({ groups: [group, ...state.groups] }))
    return group
  },

  updateGroup: (id, data) => {
    db.updateGroup(id, data)
    set((state) => ({
      groups: state.groups.map((g) => (g.id === id ? { ...g, ...data } : g)),
    }))
  },

  deleteGroup: (id) => {
    db.deleteGroup(id)
    set((state) => ({
      groups: state.groups.filter((g) => g.id !== id),
    }))
  },

  getGroup: (id) => {
    return get().groups.find((g) => g.id === id)
  },
}))
