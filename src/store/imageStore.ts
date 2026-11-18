import { create } from 'zustand'
import type { ImageAsset } from '../types'
import { generateId } from '../db/database'
import * as db from '../db/repositories'
import * as idb from '../db/idb'

export interface ImageState {
  images: ImageAsset[]
  loading: boolean
  init: () => Promise<void>
  addImage: (image: Omit<ImageAsset, 'id' | 'createdAt' | 'updatedAt'>) => ImageAsset
  updateImage: (id: string, data: Partial<Pick<ImageAsset, 'dataUrl' | 'caption' | 'prompt' | 'characterIds' | 'locationIds' | 'groupIds' | 'tags'>>) => void
  deleteImage: (id: string) => void
  getImage: (id: string) => ImageAsset | undefined
}

export const useImageStore = create<ImageState>((set, get) => ({
  images: [],
  loading: false,

  init: async () => {
    set({ loading: true })
    try {
      const rows = (await idb.idbGetAllImages()) as ImageAsset[]
      if (rows && rows.length > 0) {
        set({ images: [...rows].sort((a, b) => b.createdAt - a.createdAt), loading: false })
        return
      }
      // Migracion: si IDB vacio pero localStorage tiene imagenes, migrarlas.
      const legacy = db.getAllImages()
      if (legacy.length > 0) {
        for (const img of legacy) await idb.idbPutImage(img)
        set({ images: legacy, loading: false })
        try { localStorage.removeItem('storycreator:images') } catch { /* ignore */ }
        return
      }
      set({ images: [], loading: false })
    } catch {
      const images = db.getAllImages()
      set({ images, loading: false })
    }
  },

  addImage: (data) => {
    const now = Date.now()
    const image: ImageAsset = {
      id: generateId(),
      dataUrl: data.dataUrl,
      caption: data.caption || '',
      prompt: data.prompt || '',
      characterIds: data.characterIds || [],
      locationIds: data.locationIds || [],
      groupIds: data.groupIds || [],
      tags: data.tags || [],
      createdAt: now,
      updatedAt: now,
    }
    idb.idbPutImage(image).catch(() => {})
    set((state) => ({ images: [image, ...state.images] }))
    return image
  },

  updateImage: (id, data) => {
    set((state) => {
      const next = state.images.map((img) => (img.id === id ? { ...img, ...data, updatedAt: Date.now() } : img))
      const updated = next.find((img) => img.id === id)
      if (updated) idb.idbPutImage(updated).catch(() => {})
      return { images: next }
    })
  },

  deleteImage: (id) => {
    idb.idbDeleteImage(id).catch(() => {})
    set((state) => ({
      images: state.images.filter((img) => img.id !== id),
    }))
  },

  getImage: (id) => {
    return get().images.find((img) => img.id === id)
  },
}))
