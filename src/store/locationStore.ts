import { create } from 'zustand'
import type { Location } from '../types'
import * as db from '../db/repositories'

interface LocationState {
  locations: Location[]
  loading: boolean
  init: () => void
  addLocation: (location: Omit<Location, 'id' | 'createdAt' | 'updatedAt'>) => Location
  updateLocation: (id: string, data: Partial<Location>) => void
  deleteLocation: (id: string) => void
  getLocation: (id: string) => Location | undefined
}

export const useLocationStore = create<LocationState>((set, get) => ({
  locations: [],
  loading: false,

  init: () => {
    set({ loading: true })
    const locations = db.getAllLocations()
    set({ locations, loading: false })
  },

  addLocation: (data) => {
    const location = db.createLocation(data)
    set((state) => ({ locations: [location, ...state.locations] }))
    return location
  },

  updateLocation: (id, data) => {
    db.updateLocation(id, data)
    set((state) => ({
      locations: state.locations.map((l) =>
        l.id === id ? { ...l, ...data } : l
      ),
    }))
  },

  deleteLocation: (id) => {
    db.deleteLocation(id)
    set((state) => ({
      locations: state.locations.filter((l) => l.id !== id),
    }))
  },

  getLocation: (id) => {
    return get().locations.find((l) => l.id === id)
  },
}))
