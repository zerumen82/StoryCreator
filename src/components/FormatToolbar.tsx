interface FormatToolbarProps {
  onFormat: (prefix: string, suffix?: string) => void
  onInsertEntity?: (type: 'character' | 'location' | 'group', id: string) => void
  characters?: { id: string; name: string }[]
  locations?: { id: string; name: string }[]
  groups?: { id: string; name: string }[]
}

export default function FormatToolbar({
  onFormat,
  onInsertEntity,
  characters = [],
  locations = [],
  groups = [],
}: FormatToolbarProps) {
  return (
    <div className="flex items-center gap-1 p-1 bg-gray-900 border border-gray-800 rounded-t-xl">
      <div className="flex items-center gap-0.5 mr-2">
        <button onClick={() => onFormat('**', '**')} className="px-2 py-1 text-xs font-bold hover:bg-gray-800 rounded">B</button>
        <button onClick={() => onFormat('*', '*')} className="px-2 py-1 text-xs italic hover:bg-gray-800 rounded">I</button>
        <button onClick={() => onFormat('`', '`')} className="px-2 py-1 text-xs font-mono hover:bg-gray-800 rounded">&lt;/&gt;</button>
        <button onClick={() => onFormat('\n- ')} className="px-2 py-1 text-xs hover:bg-gray-800 rounded">• Lista</button>
        <button onClick={() => onFormat('\n> ')} className="px-2 py-1 text-xs hover:bg-gray-800 rounded">❝ Cita</button>
      </div>
      <div className="h-4 w-px bg-gray-800 mx-1" />
      <select
        onChange={(e) => {
          if (e.target.value && onInsertEntity) {
            const [type, id] = e.target.value.split(':')
            onInsertEntity(type as 'character' | 'location' | 'group', id)
          }
          e.target.value = ''
        }}
        className="bg-gray-950 border border-gray-700 rounded text-xs px-2 py-1 text-gray-300 focus:outline-none focus:border-indigo-500"
        defaultValue=""
      >
        <option value="" disabled>Insertar entidad</option>
        <optgroup label="Personajes">
          {characters.map((c) => (
            <option key={c.id} value={`character:${c.id}`}>{c.name}</option>
          ))}
        </optgroup>
        <optgroup label="Localizaciones">
          {locations.map((l) => (
            <option key={l.id} value={`location:${l.id}`}>{l.name}</option>
          ))}
        </optgroup>
        <optgroup label="Grupos">
          {groups.map((g) => (
            <option key={g.id} value={`group:${g.id}`}>{g.name}</option>
          ))}
        </optgroup>
      </select>
    </div>
  )
}
