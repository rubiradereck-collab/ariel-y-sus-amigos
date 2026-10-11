'use client'

import { MainLayout } from '@/components/layout/MainLayout'
import { createClient } from '@/lib/supabase/client'
import { useEffect, useState, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Image as ImageIcon, Upload, X, Trash2, Heart, LayoutGrid, Calendar, ZoomIn, Info } from 'lucide-react'
import { toast } from 'sonner'

export default function MemesGalleryPage() {
  const [memories, setMemories] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const [title, setTitle] = useState('')
  const [profile, setProfile] = useState<any>(null)
  
  // Novedades: Lightbox y Vistas
  const [viewMode, setViewMode] = useState<'grid' | 'collage'>('grid')
  const [selectedImage, setSelectedImage] = useState<any>(null)
  
  const fileInputRef = useRef<HTMLInputElement>(null)
  const supabase = createClient()

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        supabase.from('profiles').select('*').eq('id', user.id).single().then(({ data }) => setProfile(data))
      }
    })
    fetchMemories()
  }, [])

  async function fetchMemories() {
    // 1. Obtener de DB
    const { data, error } = await supabase
      .from('memories')
      .select('*, profiles:author_id(nickname)')
      .eq('type', 'meme')
      .order('created_at', { ascending: false })

    const dbMemories = data || []
    
    // 2. Inyectar archivos predeterminados (100% únicos sin repetir)
    const defaultMemories = [
  {
    "id": "def_1",
    "media_url": "/images/Ariel1.jpeg",
    "title": "Ariel1",
    "created_at": "2026-10-11T03:06:03.296Z",
    "profiles": {
      "nickname": "Recuerdos de los Panas"
    },
    "likes": [
      "Ariel",
      "Dereck"
    ]
  },
  {
    "id": "def_7",
    "media_url": "/images/DyD.jpg",
    "title": "DyD",
    "created_at": "2026-10-10T21:06:03.297Z",
    "profiles": {
      "nickname": "Recuerdos de los Panas"
    },
    "likes": [
      "Ariel",
      "Dereck"
    ]
  },
  {
    "id": "def_9",
    "media_url": "/images/img1.jpg",
    "title": "img1",
    "created_at": "2026-10-10T19:06:03.298Z",
    "profiles": {
      "nickname": "Recuerdos de los Panas"
    },
    "likes": [
      "Ariel",
      "Dereck"
    ]
  },
  {
    "id": "def_10",
    "media_url": "/images/img2.jpg",
    "title": "img2",
    "created_at": "2026-10-10T18:06:03.300Z",
    "profiles": {
      "nickname": "Recuerdos de los Panas"
    },
    "likes": [
      "Ariel",
      "Dereck"
    ]
  },
  {
    "id": "def_12",
    "media_url": "/images/img4.jpg",
    "title": "img4",
    "created_at": "2026-10-10T16:06:03.302Z",
    "profiles": {
      "nickname": "Recuerdos de los Panas"
    },
    "likes": [
      "Ariel",
      "Dereck"
    ]
  },
  {
    "id": "def_13",
    "media_url": "/images/img5.jpg",
    "title": "img5",
    "created_at": "2026-10-10T15:06:03.303Z",
    "profiles": {
      "nickname": "Recuerdos de los Panas"
    },
    "likes": [
      "Ariel",
      "Dereck"
    ]
  },
  {
    "id": "def_14",
    "media_url": "/images/los_seis_panas.jpg",
    "title": "los_seis_panas",
    "created_at": "2026-10-10T14:06:03.305Z",
    "profiles": {
      "nickname": "Recuerdos de los Panas"
    },
    "likes": [
      "Ariel",
      "Dereck"
    ]
  },
  {
    "id": "def_15",
    "media_url": "/images/WhatsApp Image 2026-10-10 at 18.04.27 (1).jpeg",
    "title": "2026-10-10 at 18.04.27 (1)",
    "created_at": "2026-10-10T13:06:03.306Z",
    "profiles": {
      "nickname": "Recuerdos de los Panas"
    },
    "likes": [
      "Ariel",
      "Dereck"
    ]
  },
  {
    "id": "def_16",
    "media_url": "/images/WhatsApp Image 2026-10-10 at 18.04.27 (2).jpeg",
    "title": "2026-10-10 at 18.04.27 (2)",
    "created_at": "2026-10-10T12:06:03.306Z",
    "profiles": {
      "nickname": "Recuerdos de los Panas"
    },
    "likes": [
      "Ariel",
      "Dereck"
    ]
  },
  {
    "id": "def_17",
    "media_url": "/images/WhatsApp Image 2026-10-10 at 18.07.21 (1).jpeg",
    "title": "2026-10-10 at 18.07.21 (1)",
    "created_at": "2026-10-10T11:06:03.307Z",
    "profiles": {
      "nickname": "Recuerdos de los Panas"
    },
    "likes": [
      "Ariel",
      "Dereck"
    ]
  },
  {
    "id": "def_18",
    "media_url": "/images/WhatsApp Image 2026-10-10 at 18.07.21.jpeg",
    "title": "2026-10-10 at 18.07.21",
    "created_at": "2026-10-10T10:06:03.308Z",
    "profiles": {
      "nickname": "Recuerdos de los Panas"
    },
    "likes": [
      "Ariel",
      "Dereck"
    ]
  },
  {
    "id": "def_19",
    "media_url": "/images/WhatsApp Image 2026-10-10 at 18.07.22 (1).jpeg",
    "title": "2026-10-10 at 18.07.22 (1)",
    "created_at": "2026-10-10T09:06:03.308Z",
    "profiles": {
      "nickname": "Recuerdos de los Panas"
    },
    "likes": [
      "Ariel",
      "Dereck"
    ]
  },
  {
    "id": "def_20",
    "media_url": "/images/WhatsApp Image 2026-10-10 at 18.07.22.jpeg",
    "title": "2026-10-10 at 18.07.22",
    "created_at": "2026-10-10T08:06:03.309Z",
    "profiles": {
      "nickname": "Recuerdos de los Panas"
    },
    "likes": [
      "Ariel",
      "Dereck"
    ]
  },
  {
    "id": "def_21",
    "media_url": "/images/WhatsApp Image 2026-10-10 at 18.08.42 (1).jpeg",
    "title": "2026-10-10 at 18.08.42 (1)",
    "created_at": "2026-10-10T07:06:03.309Z",
    "profiles": {
      "nickname": "Recuerdos de los Panas"
    },
    "likes": [
      "Ariel",
      "Dereck"
    ]
  },
  {
    "id": "def_22",
    "media_url": "/images/WhatsApp Image 2026-10-10 at 18.08.42 (2).jpeg",
    "title": "2026-10-10 at 18.08.42 (2)",
    "created_at": "2026-10-10T06:06:03.310Z",
    "profiles": {
      "nickname": "Recuerdos de los Panas"
    },
    "likes": [
      "Ariel",
      "Dereck"
    ]
  },
  {
    "id": "def_24",
    "media_url": "/images/WhatsApp Image 2026-10-10 at 18.08.43 (1).jpeg",
    "title": "2026-10-10 at 18.08.43 (1)",
    "created_at": "2026-10-10T04:06:03.312Z",
    "profiles": {
      "nickname": "Recuerdos de los Panas"
    },
    "likes": [
      "Ariel",
      "Dereck"
    ]
  },
  {
    "id": "def_25",
    "media_url": "/images/WhatsApp Image 2026-10-10 at 18.08.44 (2).jpeg",
    "title": "2026-10-10 at 18.08.44 (2)",
    "created_at": "2026-10-10T03:06:03.312Z",
    "profiles": {
      "nickname": "Recuerdos de los Panas"
    },
    "likes": [
      "Ariel",
      "Dereck"
    ]
  },
  {
    "id": "def_26",
    "media_url": "/images/WhatsApp Image 2026-10-10 at 18.08.44 (3).jpeg",
    "title": "2026-10-10 at 18.08.44 (3)",
    "created_at": "2026-10-10T02:06:03.314Z",
    "profiles": {
      "nickname": "Recuerdos de los Panas"
    },
    "likes": [
      "Ariel",
      "Dereck"
    ]
  },
  {
    "id": "def_27",
    "media_url": "/images/WhatsApp Image 2026-10-10 at 18.08.44.jpeg",
    "title": "2026-10-10 at 18.08.44",
    "created_at": "2026-10-10T01:06:03.314Z",
    "profiles": {
      "nickname": "Recuerdos de los Panas"
    },
    "likes": [
      "Ariel",
      "Dereck"
    ]
  },
  {
    "id": "def_28",
    "media_url": "/images/WhatsApp Image 2026-10-10 at 18.08.45 (1).jpeg",
    "title": "2026-10-10 at 18.08.45 (1)",
    "created_at": "2026-10-10T00:06:03.315Z",
    "profiles": {
      "nickname": "Recuerdos de los Panas"
    },
    "likes": [
      "Ariel",
      "Dereck"
    ]
  },
  {
    "id": "def_29",
    "media_url": "/images/WhatsApp Image 2026-10-10 at 18.08.45.jpeg",
    "title": "2026-10-10 at 18.08.45",
    "created_at": "2026-10-09T23:06:03.315Z",
    "profiles": {
      "nickname": "Recuerdos de los Panas"
    },
    "likes": [
      "Ariel",
      "Dereck"
    ]
  },
  {
    "id": "def_30",
    "media_url": "/images/WhatsApp Image 2026-10-10 at 18.08.51.jpeg",
    "title": "2026-10-10 at 18.08.51",
    "created_at": "2026-10-09T22:06:03.316Z",
    "profiles": {
      "nickname": "Recuerdos de los Panas"
    },
    "likes": [
      "Ariel",
      "Dereck"
    ]
  },
  {
    "id": "def_31",
    "media_url": "/images/WhatsApp Image 2026-10-10 at 18.08.52 (1).jpeg",
    "title": "2026-10-10 at 18.08.52 (1)",
    "created_at": "2026-10-09T21:06:03.317Z",
    "profiles": {
      "nickname": "Recuerdos de los Panas"
    },
    "likes": [
      "Ariel",
      "Dereck"
    ]
  },
  {
    "id": "def_32",
    "media_url": "/images/WhatsApp Image 2026-10-10 at 18.08.52 (2).jpeg",
    "title": "2026-10-10 at 18.08.52 (2)",
    "created_at": "2026-10-09T20:06:03.317Z",
    "profiles": {
      "nickname": "Recuerdos de los Panas"
    },
    "likes": [
      "Ariel",
      "Dereck"
    ]
  },
  {
    "id": "def_33",
    "media_url": "/images/WhatsApp Image 2026-10-10 at 18.08.52 (3).jpeg",
    "title": "2026-10-10 at 18.08.52 (3)",
    "created_at": "2026-10-09T19:06:03.318Z",
    "profiles": {
      "nickname": "Recuerdos de los Panas"
    },
    "likes": [
      "Ariel",
      "Dereck"
    ]
  },
  {
    "id": "def_34",
    "media_url": "/images/WhatsApp Image 2026-10-10 at 18.08.52 (4).jpeg",
    "title": "2026-10-10 at 18.08.52 (4)",
    "created_at": "2026-10-09T18:06:03.318Z",
    "profiles": {
      "nickname": "Recuerdos de los Panas"
    },
    "likes": [
      "Ariel",
      "Dereck"
    ]
  },
  {
    "id": "def_35",
    "media_url": "/images/WhatsApp Image 2026-10-10 at 18.08.52 (5).jpeg",
    "title": "2026-10-10 at 18.08.52 (5)",
    "created_at": "2026-10-09T17:06:03.319Z",
    "profiles": {
      "nickname": "Recuerdos de los Panas"
    },
    "likes": [
      "Ariel",
      "Dereck"
    ]
  },
  {
    "id": "def_36",
    "media_url": "/images/WhatsApp Image 2026-10-10 at 18.08.52.jpeg",
    "title": "2026-10-10 at 18.08.52",
    "created_at": "2026-10-09T16:06:03.320Z",
    "profiles": {
      "nickname": "Recuerdos de los Panas"
    },
    "likes": [
      "Ariel",
      "Dereck"
    ]
  },
  {
    "id": "def_37",
    "media_url": "/images/WhatsApp Image 2026-10-10 at 18.08.53 (1).jpeg",
    "title": "2026-10-10 at 18.08.53 (1)",
    "created_at": "2026-10-09T15:06:03.320Z",
    "profiles": {
      "nickname": "Recuerdos de los Panas"
    },
    "likes": [
      "Ariel",
      "Dereck"
    ]
  },
  {
    "id": "def_38",
    "media_url": "/images/WhatsApp Image 2026-10-10 at 18.08.53 (3).jpeg",
    "title": "2026-10-10 at 18.08.53 (3)",
    "created_at": "2026-10-09T14:06:03.323Z",
    "profiles": {
      "nickname": "Recuerdos de los Panas"
    },
    "likes": [
      "Ariel",
      "Dereck"
    ]
  },
  {
    "id": "def_39",
    "media_url": "/images/WhatsApp Image 2026-10-10 at 18.08.53 (4).jpeg",
    "title": "2026-10-10 at 18.08.53 (4)",
    "created_at": "2026-10-09T13:06:03.324Z",
    "profiles": {
      "nickname": "Recuerdos de los Panas"
    },
    "likes": [
      "Ariel",
      "Dereck"
    ]
  },
  {
    "id": "def_40",
    "media_url": "/images/WhatsApp Image 2026-10-10 at 18.08.53 (5).jpeg",
    "title": "2026-10-10 at 18.08.53 (5)",
    "created_at": "2026-10-09T12:06:03.325Z",
    "profiles": {
      "nickname": "Recuerdos de los Panas"
    },
    "likes": [
      "Ariel",
      "Dereck"
    ]
  },
  {
    "id": "def_41",
    "media_url": "/images/WhatsApp Image 2026-10-10 at 18.08.53 (6).jpeg",
    "title": "2026-10-10 at 18.08.53 (6)",
    "created_at": "2026-10-09T11:06:03.326Z",
    "profiles": {
      "nickname": "Recuerdos de los Panas"
    },
    "likes": [
      "Ariel",
      "Dereck"
    ]
  },
  {
    "id": "def_43",
    "media_url": "/images/WhatsApp Image 2026-10-10 at 18.08.54 (2).jpeg",
    "title": "2026-10-10 at 18.08.54 (2)",
    "created_at": "2026-10-09T09:06:03.328Z",
    "profiles": {
      "nickname": "Recuerdos de los Panas"
    },
    "likes": [
      "Ariel",
      "Dereck"
    ]
  },
  {
    "id": "def_44",
    "media_url": "/images/WhatsApp Image 2026-10-10 at 18.08.54 (3).jpeg",
    "title": "2026-10-10 at 18.08.54 (3)",
    "created_at": "2026-10-09T08:06:03.329Z",
    "profiles": {
      "nickname": "Recuerdos de los Panas"
    },
    "likes": [
      "Ariel",
      "Dereck"
    ]
  },
  {
    "id": "def_45",
    "media_url": "/images/WhatsApp Image 2026-10-10 at 18.08.54 (4).jpeg",
    "title": "2026-10-10 at 18.08.54 (4)",
    "created_at": "2026-10-09T07:06:03.330Z",
    "profiles": {
      "nickname": "Recuerdos de los Panas"
    },
    "likes": [
      "Ariel",
      "Dereck"
    ]
  },
  {
    "id": "def_46",
    "media_url": "/images/WhatsApp Image 2026-10-10 at 18.08.54 (5).jpeg",
    "title": "2026-10-10 at 18.08.54 (5)",
    "created_at": "2026-10-09T06:06:03.332Z",
    "profiles": {
      "nickname": "Recuerdos de los Panas"
    },
    "likes": [
      "Ariel",
      "Dereck"
    ]
  },
  {
    "id": "def_47",
    "media_url": "/images/WhatsApp Image 2026-10-10 at 18.08.55.jpeg",
    "title": "2026-10-10 at 18.08.55",
    "created_at": "2026-10-09T05:06:03.334Z",
    "profiles": {
      "nickname": "Recuerdos de los Panas"
    },
    "likes": [
      "Ariel",
      "Dereck"
    ]
  },
  {
    "id": "def_48",
    "media_url": "/images/WhatsApp Image 2026-10-10 at 18.11.02.jpeg",
    "title": "2026-10-10 at 18.11.02",
    "created_at": "2026-10-09T04:06:03.335Z",
    "profiles": {
      "nickname": "Recuerdos de los Panas"
    },
    "likes": [
      "Ariel",
      "Dereck"
    ]
  }
]
    
    // Deduplicar con DB
    const seenUrls = new Set()
    const all = [...dbMemories, ...defaultMemories].filter(m => {
      if (!m.media_url || seenUrls.has(m.media_url)) return false
      seenUrls.add(m.media_url)
      return true
    })

    setMemories(all)
    setLoading(false)
  }

  const handleUploadClick = () => {
    fileInputRef.current?.click()
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!title.trim()) {
      toast.error('Por favor, ponle un titulo al meme antes de subirlo.')
      return
    }

    setUploading(true)
    
    const fileExt = file.name.split('.').pop()
    const fileName = Math.random() + '.' + fileExt
    const filePath = profile.id + '/' + fileName

    const { error: uploadError } = await supabase.storage
      .from('memes')
      .upload(filePath, file)

    if (uploadError) {
      console.error('Upload error', uploadError)
      toast.error('Error al subir: Verifica que tengas el policy de RLS configurado.')
      setUploading(false)
      return
    }

    const { data: publicUrlData } = supabase.storage
      .from('memes')
      .getPublicUrl(filePath)

    const { error: dbError } = await supabase.from('memories').insert([
      { 
        author_id: profile.id, 
        type: 'meme',
        title: title.trim(),
        media_url: publicUrlData.publicUrl 
      }
    ])

    if (dbError) {
      toast.error('Error guardando en la base de datos.')
    } else {
      setTitle('')
      setShowModal(false)
      fetchMemories()
      toast.success('¡Meme subido exitosamente!')
    }
    setUploading(false)
  }

  const toggleLike = (memeId: string) => {
    // Simulacion interactiva (para base de datos real, requiere tabla likes)
    setMemories(prev => prev.map(m => {
      if (m.id === memeId) {
        const currentLikes = m.likes || []
        const nick = profile?.nickname || 'Anon'
        if (currentLikes.includes(nick)) {
          return { ...m, likes: currentLikes.filter((n: string) => n !== nick) }
        } else {
          return { ...m, likes: [...currentLikes, nick] }
        }
      }
      return m
    }))
  }

  // Agrupacion por fecha
  const isToday = (dateStr: string) => {
    const today = new Date()
    const date = new Date(dateStr)
    return date.getDate() === today.getDate() && date.getMonth() === today.getMonth() && date.getFullYear() === today.getFullYear()
  }

  const photosToday = memories.filter(m => isToday(m.created_at))
  const photosPast = memories.filter(m => !isToday(m.created_at))

  return (
    <MainLayout>
      <div className="w-full max-w-[1600px] mx-auto px-4 py-8">
        
        {/* Header de Galeria */}
        <div className="flex flex-col md:flex-row justify-between items-end mb-12 gap-6 bg-black/40 p-8 rounded-3xl border border-white/10 backdrop-blur-md">
          <div>
            <h1 className="text-4xl md:text-5xl font-black text-white mb-2 uppercase tracking-tight flex items-center gap-3">
              <ImageIcon className="w-10 h-10 text-pink-500" /> Galeria Central
            </h1>
            <p className="text-zinc-400 font-medium">
              Tu coleccion de fotos, memes y momentos compartidos.
            </p>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="flex bg-black/50 p-1 rounded-lg border border-white/10">
              <button 
                onClick={() => setViewMode('grid')}
                className={`px-4 py-2 rounded-md text-sm font-bold flex items-center gap-2 transition-all ${viewMode === 'grid' ? 'bg-white/10 text-white' : 'text-zinc-500 hover:text-white'}`}
              >
                <LayoutGrid className="w-4 h-4" /> Normal
              </button>
              <button 
                onClick={() => setViewMode('collage')}
                className={`px-4 py-2 rounded-md text-sm font-bold flex items-center gap-2 transition-all ${viewMode === 'collage' ? 'bg-white/10 text-white' : 'text-zinc-500 hover:text-white'}`}
              >
                <Calendar className="w-4 h-4" /> Collage
              </button>
            </div>
            <button 
              onClick={() => setShowModal(true)}
              className="bg-white text-black hover:bg-zinc-200 font-black px-6 py-3 rounded-xl flex items-center gap-2 transition-all shadow-[0_0_20px_rgba(255,255,255,0.2)] hover:scale-105"
            >
              <Upload className="w-5 h-5" /> SUBIR FOTO
            </button>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-20">
            <div className="w-12 h-12 border-4 border-pink-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <div className="space-y-16">
            
            {/* Seccion: HOY */}
            {photosToday.length > 0 && (
              <section>
                <h2 className="text-xl font-black text-white mb-6 uppercase tracking-widest flex items-center gap-2 border-b border-white/10 pb-2">
                  <span className="w-2 h-2 rounded-full bg-pink-500" /> Añadidos Hoy
                </h2>
                <div className={`gap-6 ${viewMode === 'collage' ? 'columns-1 sm:columns-2 md:columns-3 lg:columns-4 space-y-6' : 'grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5'}`}>
                  {photosToday.map(meme => (
                    <MemeCard key={meme.id} meme={meme} viewMode={viewMode} onOpen={() => setSelectedImage(meme)} onLike={() => toggleLike(meme.id)} />
                  ))}
                </div>
              </section>
            )}

            {/* Seccion: ANTERIORES */}
            {photosPast.length > 0 && (
              <section>
                <h2 className="text-xl font-black text-white mb-6 uppercase tracking-widest flex items-center gap-2 border-b border-white/10 pb-2">
                  <span className="w-2 h-2 rounded-full bg-zinc-600" /> Archivo Historico
                </h2>
                <div className={`gap-6 ${viewMode === 'collage' ? 'columns-1 sm:columns-2 md:columns-3 lg:columns-4 space-y-6' : 'grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5'}`}>
                  {photosPast.map(meme => (
                    <MemeCard key={meme.id} meme={meme} viewMode={viewMode} onOpen={() => setSelectedImage(meme)} onLike={() => toggleLike(meme.id)} />
                  ))}
                </div>
              </section>
            )}

          </div>
        )}

        {/* Modal: LIGHTBOX PARA VER FOTO */}
        <AnimatePresence>
          {selectedImage && (
            <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 md:p-10">
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 bg-black/95 backdrop-blur-xl"
                onClick={() => setSelectedImage(null)}
              />
              <motion.div 
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                className="relative z-10 w-full max-w-5xl h-[80vh] flex flex-col md:flex-row bg-zinc-950 rounded-2xl overflow-hidden border border-white/10 shadow-[0_0_50px_rgba(0,0,0,1)]"
              >
                <button onClick={() => setSelectedImage(null)} className="absolute top-4 right-4 p-2 bg-black/50 text-white rounded-full hover:bg-white/20 transition z-50">
                  <X className="w-6 h-6" />
                </button>
                
                {/* Imagen en grande */}
                <div className="flex-1 bg-black flex items-center justify-center relative group">
                  <img src={selectedImage.media_url} className="max-w-full max-h-full object-contain" />
                </div>

                {/* Panel lateral de info */}
                <div className="w-full md:w-80 bg-zinc-900 border-l border-white/5 p-6 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center gap-3 mb-6">
                      <div className="w-10 h-10 rounded-full bg-black border border-white/10 flex items-center justify-center font-bold text-white uppercase">
                        {selectedImage.profiles?.nickname?.charAt(0) || 'S'}
                      </div>
                      <div>
                        <p className="font-bold text-white leading-none">{selectedImage.profiles?.nickname || 'Sistema'}</p>
                        <p className="text-xs text-zinc-500 mt-1">{new Date(selectedImage.created_at).toLocaleString()}</p>
                      </div>
                    </div>
                    <h2 className="text-2xl font-black text-white mb-4">{selectedImage.title}</h2>
                    
                    <div className="bg-black/50 p-4 rounded-xl border border-white/5">
                      <p className="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-2 flex items-center gap-2">
                        <Heart className="w-4 h-4 text-pink-500" /> A quienes les gusta:
                      </p>
                      <div className="flex flex-wrap gap-2 mt-2">
                        {(selectedImage.likes || []).length > 0 ? (
                          (selectedImage.likes || []).map((liker: string, idx: number) => (
                            <span key={idx} className="bg-white/5 px-2 py-1 rounded text-xs text-zinc-300 border border-white/10 font-bold">{liker}</span>
                          ))
                        ) : (
                          <span className="text-xs text-zinc-600 font-bold">Sé el primero en dar like.</span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="pt-6 border-t border-white/5">
                    <button 
                      onClick={() => toggleLike(selectedImage.id)}
                      className="w-full py-3 rounded-xl flex items-center justify-center gap-2 font-bold text-lg transition-colors border border-pink-500/30 hover:bg-pink-500/20 text-pink-400"
                    >
                      <Heart className={`w-6 h-6 ${(selectedImage.likes || []).includes(profile?.nickname || 'Anon') ? 'fill-pink-500' : ''}`} /> 
                      {(selectedImage.likes || []).length} Me gusta
                    </button>
                  </div>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* Modal de Subida */}
        <AnimatePresence>
          {showModal && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setShowModal(false)} />
              <motion.div initial={{ opacity: 0, scale: 0.9, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.9, y: 20 }} className="relative bg-zinc-950 border border-white/10 p-8 rounded-3xl w-full max-w-md shadow-2xl">
                <button onClick={() => setShowModal(false)} className="absolute top-4 right-4 p-2 text-zinc-500 hover:text-white bg-black/50 rounded-full transition-colors"><X className="w-5 h-5" /></button>
                <h2 className="text-2xl font-black text-white mb-6 flex items-center gap-2"><ImageIcon className="w-6 h-6 text-pink-400" /> Nueva Foto</h2>
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-zinc-500 uppercase tracking-widest mb-2">Titulo</label>
                    <input type="text" value={title} onChange={e => setTitle(e.target.value)} placeholder="Agrega un título..." className="w-full bg-black border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-pink-500 transition-colors" />
                  </div>
                  <div className="pt-4">
                    <input type="file" accept="image/*" className="hidden" ref={fileInputRef} onChange={handleFileChange} />
                    <button onClick={handleUploadClick} disabled={uploading} className="w-full bg-white hover:bg-zinc-200 disabled:bg-zinc-800 text-black disabled:text-zinc-500 font-black py-4 rounded-xl flex justify-center items-center gap-2 transition-all">
                      {uploading ? <div className="w-5 h-5 border-2 border-black border-t-transparent rounded-full animate-spin" /> : <><Upload className="w-5 h-5" /> SELECCIONAR IMAGEN</>}
                    </button>
                  </div>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </div>
    </MainLayout>
  )
}

function MemeCard({ meme, viewMode, onOpen, onLike }: { meme: any, viewMode: string, onOpen: () => void, onLike: () => void }) {
  const likesCount = (meme.likes || []).length

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      className={`relative group bg-zinc-900 border border-white/10 overflow-hidden cursor-pointer ${viewMode === 'collage' ? 'rounded-2xl break-inside-avoid' : 'rounded-xl aspect-square'}`}
      onClick={onOpen}
    >
      <img src={meme.media_url} onError={(e) => { (e.currentTarget.closest(".group") as HTMLElement)?.style.setProperty("display", "none"); }} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" />
      
      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-end p-4">
        <h3 className="font-black text-white text-lg leading-tight mb-1 truncate">{meme.title}</h3>
        <p className="text-zinc-400 text-xs font-bold truncate">Por {meme.profiles?.nickname || 'Sistema'}</p>
        
        <div className="flex items-center gap-2 mt-3">
          <button 
            onClick={(e) => { e.stopPropagation(); onLike(); }}
            className="p-2 bg-white/10 hover:bg-pink-500/20 hover:text-pink-400 text-white rounded-lg backdrop-blur-md transition-all flex items-center gap-2 font-bold text-sm"
          >
            <Heart className={`w-4 h-4 ${likesCount > 0 ? 'fill-pink-500 text-pink-500' : ''}`} /> {likesCount}
          </button>
          <div className="p-2 bg-white/10 text-white rounded-lg backdrop-blur-md transition-all ml-auto">
            <ZoomIn className="w-4 h-4" />
          </div>
        </div>
      </div>
    </motion.div>
  )
}
