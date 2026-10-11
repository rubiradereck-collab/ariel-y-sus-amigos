'use client'

import { MainLayout } from "@/components/layout/MainLayout"
import { createClient } from "@/lib/supabase/client"
import { useEffect, useState, useRef } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { 
  Send, Hash, Users, Plus, Sparkles, Zap, Paperclip, Smile, Image as ImageIcon, 
  Mic, Settings, MoreVertical, Search, Bell, Bot, PhoneCall, Video, Headphones, 
  Music, FileAudio, Fish, Pickaxe, Palette, Heart, Swords, Hand, Square, Check, X, Loader2
} from 'lucide-react'
import EmojiPicker from 'emoji-picker-react'
import { toast } from 'sonner'
import Link from 'next/link'

export default function ChatPage() {
  const [channels, setChannels] = useState<any[]>([])
  const [activeChannel, setActiveChannel] = useState<any>(null)
  const activeChannelRef = useRef<any>(null)
  
  const [messages, setMessages] = useState<any[]>([])
  const [newMessage, setNewMessage] = useState('')
  const [showEmoji, setShowEmoji] = useState(false)
  const [profile, setProfile] = useState<any>(null)
  const [themeColor, setThemeColor] = useState('cyan')
  
  // Grabación de Voz Real (Voice Notes)
  const [isRecording, setIsRecording] = useState(false)
  const [recordingSeconds, setRecordingSeconds] = useState(0)
  const [uploadingAudio, setUploadingAudio] = useState(false)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const supabase = createClient()

  // Sincronizar referencia del canal activo
  useEffect(() => {
    activeChannelRef.current = activeChannel
  }, [activeChannel])

  useEffect(() => {
    fetchProfile()
    fetchChannels()

    const savedColor = localStorage.getItem('chatThemeColor')
    if (savedColor) setThemeColor(savedColor)

    // Listener Realtime aislado por canal
    const channel = supabase
      .channel('public:messages')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, async (payload) => {
        // Solo procesar si el mensaje pertenece al canal que el usuario está viendo actualmente
        if (activeChannelRef.current && payload.new.channel_id === activeChannelRef.current.id) {
          const { data } = await supabase
            .from('messages')
            .select('*, profiles:sender_id(nickname, avatar_url)')
            .eq('id', payload.new.id)
            .single()
            
          if (data) {
            setMessages(current => {
              if (current.some(m => m.id === data.id)) return current
              return [...current, data]
            })
            setTimeout(() => {
              const el = document.getElementById('messages-container')
              if (el) el.scrollTop = el.scrollHeight
            }, 100)
          }
        }
      })
      .subscribe()

    return () => { 
      supabase.removeChannel(channel)
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current)
    }
  }, [])

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  const fetchProfile = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single()
      setProfile(data)
    }
  }

  const fetchChannels = async () => {
    const { data } = await supabase.from('channels').select('*').order('created_at')
    if (data && data.length > 0) {
      setChannels(data)
      setActiveChannel(data[0])
      activeChannelRef.current = data[0]
      fetchMessages(data[0].id)
    }
  }

  const switchChannel = (ch: any) => {
    if (activeChannel?.id === ch.id) return
    setActiveChannel(ch)
    activeChannelRef.current = ch
    setMessages([]) // Limpiar mensajes para que no se mezclen
    fetchMessages(ch.id)
  }

  const fetchMessages = async (channelId: string) => {
    const { data, error } = await supabase
      .from('messages')
      .select('*, profiles:sender_id(nickname, avatar_url)')
      .eq('channel_id', channelId)
      .order('created_at', { ascending: true })
    
    if (data) {
      setMessages(data)
    } else {
      setMessages([])
    }
  }

  // Comandos RPG con Bot y XP
  const handleRPGCommand = async (command: string, userId: string | undefined, channelId: string | undefined) => {
    if (!userId || !channelId) {
      toast.error('Debes estar en un canal y conectado para usar el bot.')
      return
    }
    let response = ""
    let xpGained = 0
    const luck = Math.random()
    
    if (command.includes('/kiss')) {
      response = `ha besado apasionadamente a alguien del chat ❤️`
    } else if (command.includes('/kill')) {
      response = `ha eliminado a alguien del servidor ☠️`
    } else if (command.includes('/punch')) {
      response = `le dio un buen puñetazo a alguien 🥊`
    } else if (command.includes('/ship')) {
      response = `El medidor de amor dice que la compatibilidad es del ${Math.floor(Math.random() * 100)}% 💘`
    } else if (command.includes('/meme')) {
      const memes = [
        'https://images.unsplash.com/photo-1531259683007-016a7b628fc3?q=80&w=600&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1501386761578-eac5c94b800a?q=80&w=600&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1541364983171-a8ba01e95cfc?q=80&w=600&auto=format&fit=crop'
      ]
      const randomMeme = memes[Math.floor(Math.random() * memes.length)]
      response = `ha invocado un meme: [img]${randomMeme}[/img]`
    }

    // Intento 1: Ejecutar vía RPC en servidor (seguro contra manipulación)
    const { data: rpcResult, error: rpcError } = await supabase.rpc('execute_rpg_action', {
      p_command: command,
      p_channel_id: channelId
    });

    if (rpcError) {
      // Fallback si la migración de RPC aún no se ha ejecutado en Supabase
      if (response) {
        await supabase.from('messages').insert([{
          channel_id: channelId,
          sender_id: userId,
          content: `[SISTEMA RPG] ${profile?.nickname || 'Alguien'} ${response}`
        }])
      }

      if (xpGained > 0) {
        const { data: p } = await supabase.from('profiles').select('xp').eq('id', userId).single()
        if (p) {
          await supabase.from('profiles').update({ xp: (p.xp || 0) + xpGained }).eq('id', userId)
        }
      }
    }
  }

  // Envío Instantáneo Optimista (0 ms de Lag)
  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newMessage.trim() || !profile || !activeChannel) return
    const content = newMessage.trim()
    setNewMessage('')

    // 1. Inserción optimista en pantalla inmediata
    const tempId = 'temp_' + Date.now()
    const optimisticMsg = {
      id: tempId,
      channel_id: activeChannel.id,
      sender_id: profile.id,
      content,
      created_at: new Date().toISOString(),
      profiles: {
        nickname: profile.nickname || 'Tú',
        avatar_url: profile.avatar_url
      }
    }
    setMessages(prev => [...prev, optimisticMsg])

    // 2. Enviar a Supabase
    const { data } = await supabase.from('messages').insert([{
      channel_id: activeChannel.id,
      sender_id: profile.id,
      content
    }]).select('*, profiles:sender_id(nickname, avatar_url)').single()

    if (data) {
      setMessages(prev => prev.map(m => m.id === tempId ? data : m))
    }

    const lowerContent = content.toLowerCase()
    if (['/minar', '/pescar', '/kiss', '/kill', '/punch', '/ship', '/meme'].some(cmd => lowerContent.includes(cmd))) {
      setTimeout(() => {
        handleRPGCommand(lowerContent, profile.id, activeChannel.id)
      }, 800)
    }
  }

  // MÓDULO DE AUDIOS REALES (Compatible con PC, Android y iPhone/Safari)
  const [selectedMimeType, setSelectedMimeType] = useState('audio/webm')

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      
      // Detección de formato compatible para iOS/Safari
      let mimeType = 'audio/webm'
      if (typeof MediaRecorder !== 'undefined') {
        if (MediaRecorder.isTypeSupported('audio/webm')) {
          mimeType = 'audio/webm'
        } else if (MediaRecorder.isTypeSupported('audio/mp4')) {
          mimeType = 'audio/mp4'
        } else if (MediaRecorder.isTypeSupported('audio/ogg')) {
          mimeType = 'audio/ogg'
        }
      }
      setSelectedMimeType(mimeType)

      const options = mimeType ? { mimeType } : undefined
      const mediaRecorder = new MediaRecorder(stream, options)
      mediaRecorderRef.current = mediaRecorder
      audioChunksRef.current = []

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data)
      }

      mediaRecorder.start()
      setIsRecording(true)
      setRecordingSeconds(0)

      timerIntervalRef.current = setInterval(() => {
        setRecordingSeconds(s => s + 1)
      }, 1000)

      toast.success('Grabando audio...')
    } catch (err: any) {
      toast.error('No se pudo acceder al micrófono: ' + err.message)
    }
  }

  const stopAndSendAudio = () => {
    if (!mediaRecorderRef.current || !activeChannel || !profile) return
    
    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current)
    setIsRecording(false)
    setUploadingAudio(true)

    mediaRecorderRef.current.onstop = async () => {
      const extension = selectedMimeType.includes('mp4') ? 'mp4' : selectedMimeType.includes('ogg') ? 'ogg' : 'webm'
      const audioBlob = new Blob(audioChunksRef.current, { type: selectedMimeType })
      const filename = `voice_${Date.now()}_${profile.id.slice(0, 5)}.${extension}`

      // Subir archivo al bucket de Supabase
      const { data, error } = await supabase.storage.from('musica').upload(filename, audioBlob, { contentType: selectedMimeType })

      if (error) {
        toast.error('Error al subir audio: ' + error.message)
      } else {
        const { data: urlData } = supabase.storage.from('musica').getPublicUrl(filename)
        const audioUrl = urlData.publicUrl

        // Insertar mensaje de audio en el chat
        const audioContent = `[audio]${audioUrl}[/audio]`
        await supabase.from('messages').insert([{
          channel_id: activeChannel.id,
          sender_id: profile.id,
          content: audioContent
        }])
        toast.success('¡Nota de voz enviada!')
      }
      setUploadingAudio(false)
      audioChunksRef.current = []
    }

    mediaRecorderRef.current.stop()
    // Detener todas las pistas de audio para apagar el micrófono
    mediaRecorderRef.current.stream?.getTracks().forEach(track => track.stop())
  }

  const cancelRecording = () => {
    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current)
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop()
      mediaRecorderRef.current.stream?.getTracks().forEach(track => track.stop())
    }
    setIsRecording(false)
    audioChunksRef.current = []
    toast.info('Grabación cancelada')
  }

  const getThemeStyles = () => {
    switch (themeColor) {
      case 'cyan': return 'from-cyan-500 to-blue-500 text-cyan-400 border-cyan-500/30 bg-cyan-500/10'
      case 'pink': return 'from-pink-500 to-rose-500 text-pink-400 border-pink-500/30 bg-pink-500/10'
      case 'emerald': return 'from-emerald-500 to-teal-500 text-emerald-400 border-emerald-500/30 bg-emerald-500/10'
      default: return 'from-cyan-500 to-blue-500 text-cyan-400 border-cyan-500/30 bg-cyan-500/10'
    }
  }

  const changeTheme = (color: string) => {
    setThemeColor(color)
    localStorage.setItem('chatThemeColor', color)
  }

  const activeTheme = getThemeStyles()

  return (
    <MainLayout>
      <div className="absolute inset-0 pt-32 pb-24 px-4 flex gap-4 max-w-[1600px] mx-auto overflow-hidden">
        
        {/* SIDEBAR (Canales) */}
        <div className="w-72 flex-shrink-0 flex flex-col gap-4">
          <div className="bg-black/80 backdrop-blur-3xl border border-white/10 rounded-2xl flex-1 flex flex-col overflow-hidden shadow-2xl relative">
            <div className="p-5 border-b border-white/5 relative">
              <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-transparent via-cyan-500 to-transparent opacity-50" />
              <h2 className={`text-xl font-black text-transparent bg-clip-text bg-gradient-to-r ${activeTheme.split(' ')[0]} ${activeTheme.split(' ')[1]} flex items-center gap-3`}>
                <Zap className={`w-5 h-5 ${activeTheme.split(' ')[2]}`} /> RED COM.
              </h2>
            </div>
            
            <div className="flex-1 overflow-y-auto hide-scrollbar p-3 space-y-1">
              <div className="text-xs font-bold text-zinc-500 uppercase tracking-widest px-2 mb-2 mt-2">Canales</div>
              {channels.map(ch => (
                <button
                  key={ch.id}
                  onClick={() => switchChannel(ch)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-300 font-bold group ${
                    activeChannel?.id === ch.id 
                      ? 'bg-white/10 text-white shadow-[inset_0_0_20px_rgba(255,255,255,0.05)]' 
                      : 'text-zinc-500 hover:bg-white/5 hover:text-zinc-300'
                  }`}
                >
                  <Hash className={`w-4 h-4 ${activeChannel?.id === ch.id ? activeTheme.split(' ')[2] : 'text-zinc-600 group-hover:text-zinc-400'}`} />
                  {ch.name}
                </button>
              ))}
            </div>

            <div className="p-4 bg-white/5 border-t border-white/5 flex flex-col gap-3">
              <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-1 text-center">Tinte de Interfaz</span>
              <div className="flex items-center justify-center gap-4">
                <button onClick={() => changeTheme('cyan')} className={`w-6 h-6 rounded-full bg-cyan-500 hover:scale-110 transition-transform ${themeColor === 'cyan' ? 'ring-2 ring-white ring-offset-2 ring-offset-black shadow-[0_0_15px_rgba(6,182,212,0.8)]' : ''}`} />
                <button onClick={() => changeTheme('pink')} className={`w-6 h-6 rounded-full bg-pink-500 hover:scale-110 transition-transform ${themeColor === 'pink' ? 'ring-2 ring-white ring-offset-2 ring-offset-black shadow-[0_0_15px_rgba(236,72,153,0.8)]' : ''}`} />
                <button onClick={() => changeTheme('emerald')} className={`w-6 h-6 rounded-full bg-emerald-500 hover:scale-110 transition-transform ${themeColor === 'emerald' ? 'ring-2 ring-white ring-offset-2 ring-offset-black shadow-[0_0_15px_rgba(16,185,129,0.8)]' : ''}`} />
              </div>
            </div>
          </div>
        </div>

        {/* ÁREA DE CHAT */}
        <div className="flex-1 bg-black/80 backdrop-blur-3xl border border-white/10 rounded-2xl flex flex-col overflow-hidden shadow-2xl relative">
          
          <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-br from-white/5 to-transparent rounded-full blur-[100px] pointer-events-none" />

          {activeChannel && (
            <div className="px-6 py-4 border-b border-white/5 bg-white/5 flex items-center justify-between z-10 backdrop-blur-md">
              <div className="flex items-center gap-3">
                <Hash className={`w-6 h-6 ${activeTheme.split(' ')[2]}`} />
                <h3 className="text-lg font-black text-white">{activeChannel.name}</h3>
                <div className="h-4 w-px bg-white/20 mx-2" />
                <p className="text-xs text-zinc-400 font-medium">{activeChannel.description}</p>
              </div>
              
              <div className="flex items-center gap-4 text-zinc-400">
                <PhoneCall className="w-5 h-5 hover:text-white cursor-pointer" />
                <Video className="w-5 h-5 hover:text-white cursor-pointer" />
                <div className="relative">
                  <input type="text" placeholder="Buscar..." className="bg-black/50 border border-white/10 rounded-md py-1 pl-8 pr-3 text-xs focus:outline-none focus:border-white/30" />
                  <Search className="w-3 h-3 absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-500" />
                </div>
              </div>
            </div>
          )}

          {/* MENSAJES */}
          <div id="messages-container" className="flex-1 overflow-y-auto p-6 space-y-6 hide-scrollbar relative z-10 scroll-smooth">
            <AnimatePresence initial={false}>
              {messages.map((msg, i) => {
                const isMe = msg.sender_id === profile?.id
                const showHeader = i === 0 || messages[i-1].sender_id !== msg.sender_id
                const isSystem = msg.content?.startsWith('[SISTEMA') || msg.content?.startsWith('[BOT]')
                const isAudio = msg.content?.includes('[audio]')
                const isMeme = msg.content?.includes('[img]')

                return (
                  <motion.div 
                    key={msg.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} ${isSystem ? 'items-center my-6' : ''}`}
                  >
                    {isSystem ? (
                      <div className={`bg-white/5 border border-white/10 px-6 py-3 rounded-2xl flex flex-col items-center gap-2 text-sm font-black tracking-wider shadow-lg max-w-lg ${activeTheme.split(' ')[2]}`}>
                        <div className="flex items-center gap-2">
                          <Bot className="w-5 h-5" />
                          <span className="font-mono text-white text-xs">
                            {msg.content.split('[img]')[0].replace('[SISTEMA RPG]', '')}
                          </span>
                        </div>
                        {isMeme && (
                          <div className="mt-2 rounded-xl overflow-hidden border border-white/10 max-w-xs">
                            <img 
                              src={msg.content.split('[img]')[1]?.replace('[/img]', '')} 
                              alt="Meme" 
                              className="w-full h-auto object-cover" 
                            />
                          </div>
                        )}
                      </div>
                    ) : (
                      <>
                        {showHeader && (
                          <div className={`flex items-end gap-3 mb-1 ${isMe ? 'flex-row-reverse' : 'flex-row'}`}>
                            <div className="w-8 h-8 flex-shrink-0 bg-black rounded-full border border-white/10 overflow-hidden relative">
                              {msg.profiles?.avatar_url ? (
                                <img src={msg.profiles.avatar_url} alt="Avatar" className="w-full h-full object-cover object-top scale-110" />
                              ) : (
                                <span className="font-bold text-white text-xs w-full h-full flex items-center justify-center">{msg.profiles?.nickname?.charAt(0) || '?'}</span>
                              )}
                            </div>
                            <div className={`flex items-baseline gap-2 ${isMe ? 'flex-row-reverse' : 'flex-row'}`}>
                              <span className="text-[13px] font-bold text-white hover:underline cursor-pointer">
                                {msg.profiles?.nickname}
                              </span>
                              <span className="text-[10px] text-zinc-500">
                                {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </div>
                          </div>
                        )}
                        
                        <div className={`
                          max-w-[70%] px-4 py-2.5 rounded-2xl relative group text-[14.5px] leading-relaxed
                          ${isMe 
                            ? `bg-gradient-to-br ${activeTheme.split(' ')[0]} ${activeTheme.split(' ')[1]} text-white rounded-tr-sm shadow-md` 
                            : 'bg-zinc-800 text-zinc-100 rounded-tl-sm'}
                        `}>
                          {isAudio ? (
                            <div className="py-1">
                              <span className="text-[11px] font-bold text-white/70 block mb-1">Nota de Voz 🎙️</span>
                              <audio 
                                controls 
                                src={msg.content.replace('[audio]', '').replace('[/audio]', '')} 
                                className="max-w-[280px] md:max-w-sm h-10 rounded-lg" 
                              />
                            </div>
                          ) : isMeme ? (
                            <div>
                              <p className="break-words mb-2">{msg.content.split('[img]')[0]}</p>
                              <img src={msg.content.split('[img]')[1]?.replace('[/img]', '')} alt="Meme" className="rounded-xl max-h-64 border border-white/20" />
                            </div>
                          ) : (
                            <p className="break-words">{msg.content}</p>
                          )}
                        </div>
                      </>
                    )}
                  </motion.div>
                )
              })}
            </AnimatePresence>
            <div ref={messagesEndRef} />
          </div>

          {/* BOTONES INTERACCIÓN & ENLACES RPG */}
          <div className="px-6 py-2.5 bg-black/60 border-t border-white/5 flex gap-2 overflow-x-auto hide-scrollbar z-20 items-center">
            <span className="text-xs font-black text-white uppercase tracking-widest flex items-center mr-2 bg-white/10 px-3 py-1 rounded-md">
              <Sparkles className="w-3 h-3 mr-1 text-yellow-400" /> SOCIAL:
            </span>
            <button onClick={() => handleRPGCommand('/meme', profile?.id, activeChannel?.id)} className="bg-zinc-900 hover:bg-emerald-500/20 text-white border border-white/10 text-xs font-bold px-4 py-1.5 rounded-lg transition-colors flex items-center gap-2 whitespace-nowrap"><ImageIcon className="w-4 h-4 text-emerald-400"/> Meme</button>
            <button onClick={() => handleRPGCommand('/kiss', profile?.id, activeChannel?.id)} className="bg-zinc-900 hover:bg-pink-500/20 text-white border border-white/10 text-xs font-bold px-4 py-1.5 rounded-lg transition-colors flex items-center gap-2 whitespace-nowrap"><Heart className="w-4 h-4 text-pink-400"/> Kiss</button>
            <button onClick={() => handleRPGCommand('/kill', profile?.id, activeChannel?.id)} className="bg-zinc-900 hover:bg-red-500/20 text-white border border-white/10 text-xs font-bold px-4 py-1.5 rounded-lg transition-colors flex items-center gap-2 whitespace-nowrap"><Swords className="w-4 h-4 text-red-400"/> Kill</button>
            <button onClick={() => handleRPGCommand('/punch', profile?.id, activeChannel?.id)} className="bg-zinc-900 hover:bg-yellow-500/20 text-white border border-white/10 text-xs font-bold px-4 py-1.5 rounded-lg transition-colors flex items-center gap-2 whitespace-nowrap"><Hand className="w-4 h-4 text-yellow-400"/> Punch</button>
            <button onClick={() => handleRPGCommand('/ship', profile?.id, activeChannel?.id)} className="bg-zinc-900 hover:bg-purple-500/20 text-white border border-white/10 text-xs font-bold px-4 py-1.5 rounded-lg transition-colors flex items-center gap-2 whitespace-nowrap"><Heart className="w-4 h-4 text-purple-400"/> Ship</button>
            <div className="h-5 w-[1px] bg-white/10 mx-1 flex-shrink-0" />
            <Link href="/aventura" className="bg-gradient-to-r from-amber-600/30 to-orange-600/30 hover:from-amber-600/50 hover:to-orange-600/50 text-amber-300 border border-amber-500/30 text-xs font-bold px-4 py-1.5 rounded-lg transition-all flex items-center gap-2 whitespace-nowrap shadow-sm">
              <Pickaxe className="w-4 h-4 text-amber-400" /> Aventura & Minería
            </Link>
            <Link href="/apuestas" className="bg-gradient-to-r from-purple-600/30 to-pink-600/30 hover:from-purple-600/50 hover:to-pink-600/50 text-pink-300 border border-pink-500/30 text-xs font-bold px-4 py-1.5 rounded-lg transition-all flex items-center gap-2 whitespace-nowrap shadow-sm">
              <Zap className="w-4 h-4 text-pink-400" /> Casino & Apuestas
            </Link>
          </div>
          
          {/* INPUT AREA Y GRABADORA DE VOZ */}
          <div className="px-6 pb-6 pt-3 bg-transparent">
            {isRecording ? (
              <div className="bg-red-950/40 border border-red-500/40 rounded-xl px-4 py-3 flex items-center justify-between animate-pulse">
                <div className="flex items-center gap-3">
                  <div className="w-3 h-3 rounded-full bg-red-500 animate-ping" />
                  <span className="text-red-400 font-bold text-sm">Grabando nota de voz...</span>
                  <span className="font-mono text-white text-sm bg-black/50 px-2 py-0.5 rounded">
                    0:{recordingSeconds < 10 ? `0${recordingSeconds}` : recordingSeconds}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button 
                    onClick={cancelRecording}
                    className="p-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition-colors flex items-center gap-1 text-xs font-bold"
                  >
                    <X className="w-4 h-4" /> Cancelar
                  </button>
                  <button 
                    onClick={stopAndSendAudio}
                    className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-white transition-colors flex items-center gap-1.5 text-xs font-bold shadow-lg"
                  >
                    <Send className="w-4 h-4" /> Enviar Audio
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={sendMessage} className="relative flex items-end gap-3">
                <div className="flex-1 bg-zinc-900 border border-white/10 rounded-xl flex items-center px-2 py-1 shadow-inner focus-within:border-zinc-700 transition-colors">
                  
                  <input
                    type="text"
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    placeholder={`Enviar mensaje a #${activeChannel?.name || 'chat'}...`}
                    className="flex-1 bg-transparent border-none px-3 py-2.5 text-zinc-100 placeholder-zinc-500 focus:outline-none text-[15px]"
                  />
                  
                  <div className="flex items-center gap-1 pr-2">
                    {/* Botón Micrófono Real */}
                    <button 
                      type="button" 
                      onClick={startRecording}
                      disabled={uploadingAudio}
                      title="Grabar nota de voz"
                      className="p-2 text-zinc-400 hover:text-red-400 hover:bg-white/5 rounded-lg transition-colors"
                    >
                      {uploadingAudio ? <Loader2 className="w-5 h-5 animate-spin text-red-400" /> : <Mic className="w-5 h-5" />}
                    </button>

                    {/* Selector de Emojis */}
                    <div className="relative">
                      <button 
                        type="button" 
                        onClick={() => setShowEmoji(!showEmoji)} 
                        className="p-2 text-zinc-400 hover:text-white hover:bg-white/5 rounded-lg transition-colors"
                      >
                        <Smile className="w-5 h-5" />
                      </button>
                      {showEmoji && (
                        <div className="absolute bottom-full right-0 mb-4 z-[9999] shadow-2xl">
                          <EmojiPicker onEmojiClick={(e) => setNewMessage(newMessage + e.emoji)} theme="dark" />
                        </div>
                      )}
                    </div>

                    <button 
                      type="submit" 
                      disabled={!newMessage.trim()} 
                      className={`p-2.5 rounded-lg text-white transition-all disabled:opacity-40 disabled:hover:bg-transparent ${activeTheme.split(' ')[0]} bg-gradient-to-r ${activeTheme.split(' ')[1]}`}
                    >
                      <Send className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </form>
            )}
          </div>

        </div>
      </div>
    </MainLayout>
  )
}
