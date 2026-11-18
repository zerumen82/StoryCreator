# StoryCreator

Generador de historias interactivo con IA local (Ollama) o cloud (OpenAI/Groq).

## Características

- **Chat con personajes**: Habla directamente con tus personajes en primera persona
- **Historias interactivas**: La IA escribe escenas y te da opciones para decidir el rumbo
- **Entrevistas**: La IA pregunta sobre tus personajes para aprender y usarlos mejor en historias
- **Caption Studio**: Analiza fotos con IA de visión y genera captions creativos
- **Generación de imágenes**: Compose imágenes con Stable Diffusion local (ComfyUI)
- **Relaciones**: Define parentesco y afinidad entre personajes
- **Memoria**: La IA aprende de tus preferencias y feedback
- **Exportar PDF**: Guarda tus historias y conversaciones
- **Persistencia**: Almacenamiento local en el navegador/Electron (localStorage)

## Requisitos

- [Node.js](https://nodejs.org/) 18+
- [Ollama](https://ollama.ai/) (para IA local) o API key de OpenAI/Groq

## Instalación

```bash
git clone https://github.com/zerumen82/StoryCreator.git
cd StoryCreator
npm install
npm run electron:dev
```

## Modelos Ollama

```bash
ollama pull llama3    # Texto
ollama pull llava     # Visión (fotos)
```

## Build

```bash
npm run electron:build
```

El instalador se genera en `release/`.

## Tecnologías

- React + TypeScript
- Electron
- Zustand (estado)
- localStorage (persistencia)
- Tailwind CSS
- Ollama / OpenAI API
