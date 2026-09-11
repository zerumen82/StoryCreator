import { create } from 'zustand'
import type { ImageAsset } from '../types'
import * as db from '../db/repositories'

export interface ImageState {
  images: ImageAsset[]
  loading: boolean
  init: () => void
  addImage: (image: Omit<ImageAsset, 'id' | 'createdAt' | 'updatedAt'>) => ImageAsset
  updateImage: (id: string, data: Partial<Pick<ImageAsset, 'dataUrl' | 'caption' | 'prompt' | 'characterIds' | 'locationIds' | 'groupIds' | 'tags'>>) => void
  deleteImage: (id: string) => void
  getImage: (id: string) => ImageAsset | undefined
}

export const useImageStore = create<ImageState>((set, get) => ({
  images: [],
  loading: false,

  init: () => {
    set({ loading: true })
    const images = db.getAllImages()
    set({ images, loading: false })
  },

  addImage: (data) => {
    const image = db.createImage(data)
    set((state) => ({ images: [image, ...state.images] }))
    return image
  },

  updateImage: (id, data) => {
    db.updateImage(id, data)
    set((state) => ({
      images: state.images.map((img) => (img.id === id ? { ...img, ...data } : img)),
    }))
  },

  deleteImage: (id) => {
    db.deleteImage(id)
    set((state) => ({
      images: state.images.filter((img) => img.id !== id),
    }))
  },

  getImage: (id) => {
    return get().images.find((img) => img.id === id)
  },
}))
