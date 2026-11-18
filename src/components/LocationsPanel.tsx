import { useState } from 'react'
import { useLocationStore } from '../store/locationStore'
import type { Location } from '../types'
import EntityModal from './EntityModal'

const emptyLocation: Omit<Location, 'id' | 'createdAt' | 'updatedAt'> = {
  name: '',
  description: '',
  image: null,
  type: 'other',
  atmosphere: '',
}

export default function LocationsPanel() {
  const { locations, addLocation, updateLocation, deleteLocation } = useLocationStore()
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState(emptyLocation)
  const [modalOpen, setModalOpen] = useState(false)
  const [search, setSearch] = useState('')

  const openCreate = () => {
    setEditingId(null)
    setForm(emptyLocation)
    setModalOpen(true)
  }

  const openEdit = (loc: Location) => {
    setEditingId(loc.id)
    setForm({
      name: loc.name,
      description: loc.description,
      image: loc.image,
      type: loc.type,
      atmosphere: loc.atmosphere,
    })
    setModalOpen(true)
  }

  const handleSave = () => {
    if (!form.name.trim()) return
    if (editingId) {
      updateLocation(editingId, form)
    } else {
      addLocation(form)
    }
    setModalOpen(false)
  }

  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold">Localizaciones</h2>
          <button onClick={openCreate} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-lg text-sm font-medium">
            + Nueva localización
          </button>
        </div>

        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar localización por nombre..."
          className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-sm focus:outline-none focus:border-indigo-500"
        />

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {locations.filter((l) => !search.trim() || l.name.toLowerCase().includes(search.trim().toLowerCase())).map((loc) => (
            <div key={loc.id} className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden space-y-3 group">
              {loc.image && <img src={loc.image} alt={loc.name} className="w-full h-40 object-cover" />}
              <div className="p-4 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="font-semibold text-lg">{loc.name || 'Sin nombre'}</h3>
                    <span className="text-xs text-gray-500 capitalize">{loc.type}</span>
                  </div>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => openEdit(loc)} className="px-2 py-1 bg-gray-800 hover:bg-gray-700 rounded text-xs">Editar</button>
                    <button onClick={() => { if (window.confirm('¿Borrar esta localización?')) deleteLocation(loc.id) }} className="px-2 py-1 bg-red-900/40 hover:bg-red-900/60 text-red-300 rounded text-xs">Borrar</button>
                  </div>
                </div>
                <p className="text-sm text-gray-400 line-clamp-2">{loc.description}</p>
                {loc.atmosphere && <p className="text-xs text-gray-500 italic">Atmósfera: {loc.atmosphere}</p>}
              </div>
            </div>
          ))}
        </div>

        {locations.length === 0 && (
          <div className="text-center py-20 text-gray-500">
            <p className="text-4xl mb-4">📍</p>
            <p>No hay localizaciones. Crea la primera para comenzar.</p>
          </div>
        )}
      </div>

      <EntityModal
        title={editingId ? 'Editar localización' : 'Nueva localización'}
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSubmit={handleSave}
      >
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-gray-400 mb-1">Nombre</label>
              <input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full px-3 py-2 bg-gray-950 border border-gray-700 rounded-lg text-sm focus:outline-none focus:border-indigo-500"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Tipo</label>
              <select
                value={form.type}
                onChange={(e) => setForm({ ...form, type: e.target.value as Location['type'] })}
                className="w-full px-3 py-2 bg-gray-950 border border-gray-700 rounded-lg text-sm focus:outline-none focus:border-indigo-500"
              >
                <option value="city">Ciudad</option>
                <option value="wilderness">Naturaleza</option>
                <option value="building">Edificio</option>
                <option value="fantasy">Fantasía</option>
                <option value="sci-fi">Ciencia ficción</option>
                <option value="other">Otro</option>
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm text-gray-400 mb-1">Descripción</label>
              <textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                className="w-full px-3 py-2 bg-gray-950 border border-gray-700 rounded-lg text-sm focus:outline-none focus:border-indigo-500 h-20 resize-none"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm text-gray-400 mb-1">Atmósfera</label>
              <input
                value={form.atmosphere}
                onChange={(e) => setForm({ ...form, atmosphere: e.target.value })}
                className="w-full px-3 py-2 bg-gray-950 border border-gray-700 rounded-lg text-sm focus:outline-none focus:border-indigo-500"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Imagen</label>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (!file) return
                  const reader = new FileReader()
                  reader.onload = () => setForm({ ...form, image: reader.result as string })
                  reader.readAsDataURL(file)
                }}
                className="text-sm text-gray-400"
              />
              {form.image && <img src={form.image} alt="Preview" className="mt-2 w-24 h-24 object-cover rounded-lg border border-gray-700" />}
            </div>
          </div>
        </div>
      </EntityModal>
    </div>
  )
}
