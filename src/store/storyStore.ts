import { create } from 'zustand'
import * as db from '../db/repositories'

interface Story {
  id: string
  title: string
  content: string
  characterIds: string[]
  locationIds: string[]
  groupIds: string[]
  status: 'draft' | 'in_progress' | 'completed'
  rating: number
  createdAt: number
  updatedAt: number
}

interface StoryState {
  stories: Story[]
  currentStoryId: string | null
  loading: boolean
  init: () => void
  createStory: (title: string) => string
  selectStory: (id: string) => void
  updateStory: (id: string, data: Partial<Story>) => void
  deleteStory: (id: string) => void
  rateStory: (id: string, rating: number) => void
}

export const useStoryStore = create<StoryState>((set) => ({
  stories: [],
  currentStoryId: null,
  loading: false,

  init: () => {
    set({ loading: true })
    const rows = db.getAllStories()
    const stories: Story[] = rows.map(row => ({
      id: row.id,
      title: row.title,
      content: row.content,
      characterIds: JSON.parse(row.character_ids || '[]'),
      locationIds: JSON.parse(row.location_ids || '[]'),
      groupIds: JSON.parse(row.group_ids || '[]'),
      status: row.status as Story['status'],
      rating: row.rating,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    }))
    set({ stories, loading: false })
  },

  createStory: (title) => {
    const id = db.createStory(title)
    const story: Story = {
      id,
      title,
      content: '',
      characterIds: [],
      locationIds: [],
      groupIds: [],
      status: 'draft',
      rating: 0,
      createdAt: Date.now(),
      updatedAt: Date.now()
    }
    set((state) => ({
      stories: [story, ...state.stories],
      currentStoryId: id
    }))
    return id
  },

  selectStory: (id) => {
    set({ currentStoryId: id })
  },

  updateStory: (id, data) => {
    const dbData: Record<string, unknown> = {}
    if (data.title !== undefined) dbData.title = data.title
    if (data.content !== undefined) dbData.content = data.content
    if (data.characterIds !== undefined) dbData.character_ids = JSON.stringify(data.characterIds)
    if (data.locationIds !== undefined) dbData.location_ids = JSON.stringify(data.locationIds)
    if (data.groupIds !== undefined) dbData.group_ids = JSON.stringify(data.groupIds)
    if (data.status !== undefined) dbData.status = data.status
    if (data.rating !== undefined) dbData.rating = data.rating
    db.updateStory(id, dbData as Partial<db.StoryRow>)
    set((state) => ({
      stories: state.stories.map(s => s.id === id ? { ...s, ...data } : s)
    }))
  },

  deleteStory: (id) => {
    db.deleteStory(id)
    set((state) => ({
      stories: state.stories.filter(s => s.id !== id),
      currentStoryId: state.currentStoryId === id ? null : state.currentStoryId
    }))
  },

  rateStory: (id, rating) => {
    db.updateStory(id, { rating })
    set((state) => ({
      stories: state.stories.map(s => s.id === id ? { ...s, rating } : s)
    }))
  }
}))