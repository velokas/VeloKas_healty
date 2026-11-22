'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Activity, ArrowDownRight, ArrowLeft, ArrowRight, Bell,   CalendarDays, Camera, Check,
  ChevronDown, CirclePlay, Clock3, Dumbbell, Download, Eye, EyeOff, Flame, ImagePlus,
  Footprints, Heart, LayoutDashboard, LayoutGrid, ListFilter, LockKeyhole, LogIn, Mail, Menu, MessageCircle,
  MoreHorizontal, Moon, Plus, Search, Send, Settings2, Share2, Sparkles, Sun, Target,
  Trash2, TrendingUp, Trophy, UserPlus, UserRound, Users, X, type LucideIcon,
} from 'lucide-react'

type Page = 'Overview' | 'My workouts' | 'Class schedule' | 'Progress' | 'Community' | 'Settings' | 'Profile' | 'Messages' | 'Search'
type Theme = 'dark' | 'light'
type WorkoutType = 'STRENGTH' | 'HIIT' | 'RECOVERY'
type DayLabel = 'MON' | 'TUE' | 'WED' | 'THU' | 'FRI' | 'SAT' | 'SUN'
type Modal = 'create' | 'goal' | 'about' | 'password' | 'post' | null

type Workout = {
  id: string
  name: string
  type: WorkoutType
  duration: string
  level: string
  focus: string
  tag: string
}

type Session = {
  id: string
  time: string
  name: string
  coach: string
  type: WorkoutType
  duration: string
}

type CommunityPost = {
  id: string
  author: string
  initials: string
  caption: string
  image: string
  likes: number
  tag: string
  createdAt?: string
}

type RawCommunityPost = {
  id: string
  category: string
  imageUrl: string
  caption: string | null
  createdAt: string
  user: { id: string; name: string | null; email: string }
}

function normalizeCommunityPost(post: RawCommunityPost): CommunityPost {
  const displayName = post.user.name ?? post.user.email.split('@')[0]
  return {
    id: post.id,
    author: displayName,
    initials: displayName
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part.charAt(0).toUpperCase())
      .join(''),
    caption: post.caption ?? '',
    image: post.imageUrl,
    likes: 0,
    tag: post.category,
    createdAt: post.createdAt,
  }
}

type PhotoPost = {
  id: string
  image: string
  images?: string[]
  caption: string
  likes: number
  liked: boolean
  createdAt: string
}

const MAX_POST_IMAGES = 10
const postImages = (post: PhotoPost) => post.images?.length ? post.images : [post.image]

type ChatMessage = {
  id: number
  from: 'coach' | 'me'
  text: string
  time: string
}

type StoryPost = {
  id: string
  image: string
  createdAt: string
}

type RawPhoto = {
  id: string
  caption: string | null
  likes: number
  createdAt: string
  images: { id: string; url: string; order: number }[]
}

type RawStory = {
  id: string
  mediaUrl: string
  caption: string | null
  createdAt: string
}

function normalizePhoto(photo: RawPhoto): PhotoPost {
  return {
    id: photo.id,
    image: photo.images[0]?.url ?? '',
    images: photo.images.map((image) => image.url),
    caption: photo.caption ?? '',
    likes: photo.likes,
    liked: false,
    createdAt: photo.createdAt,
  }
}

function normalizeStory(story: RawStory): StoryPost {
  return { id: story.id, image: story.mediaUrl, createdAt: story.createdAt }
}

function textPostImage(text: string): string {
  const escapeXml = (value: string) => value.replace(/[<>&"']/g, (char) => ({
    '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;',
  })[char] ?? char)
  const label = escapeXml(text.slice(0, 120))
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="640"><rect width="640" height="640" fill="#101928"/><text x="36" y="64" fill="#f8fafc" font-family="sans-serif" font-size="26" font-weight="700">FORMA ATHLETIC CLUB</text><foreignObject x="36" y="120" width="568" height="460"><div xmlns="http://www.w3.org/1999/xhtml" style="color:#cbd5e1;font:24px sans-serif;white-space:pre-wrap">${label}</div></foreignObject></svg>`
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`
}

type GoogleTokenResponse = { access_token?: string; error?: string }

type GoogleTokenClient = {
  requestAccessToken: () => void
}

declare global {
  interface Window {
    google?: {
      accounts: {
        oauth2: {
          initTokenClient: (config: {
            client_id: string
            scope: string
            callback: (response: GoogleTokenResponse) => void
            error_callback?: (error: { type: string }) => void
          }) => GoogleTokenClient
        }
      }
    }
  }
}

let googleScriptPromise: Promise<void> | null = null

type SessionUser = {
  id: string
  name: string
  email: string
  club: string
  avatar: string | null
  bio: string | null
  photos: PhotoPost[]
  stories: StoryPost[]
}

type UserResponse = { user: SessionUser }

type DashboardProps = {
  user: SessionUser
  theme: Theme
  onThemeChange: (theme: Theme) => void
  onSignOut: () => void
  onUserChange: (user: SessionUser) => void
  onUpdateUser: (patch: Partial<SessionUser>) => Promise<void>
}

const THEME_KEY = 'forma.theme'

const DAY_LABELS: DayLabel[] = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN']
const BASE_DATE = Date.UTC(2026, 10, 18)
const DAY_MS = 86_400_000

const NAV_ITEMS: { label: Page; icon: LucideIcon }[] = [
  { label: 'Overview', icon: LayoutDashboard },
  { label: 'My workouts', icon: Dumbbell },
  { label: 'Search', icon: Search },
  { label: 'Class schedule', icon: CalendarDays },
  { label: 'Progress', icon: TrendingUp },
  { label: 'Community', icon: Users },
  { label: 'Settings', icon: Settings2 },
]

const MOBILE_ITEMS: { label: string; page?: Page; icon: LucideIcon }[] = [
  { label: 'Home', page: 'Overview', icon: LayoutDashboard },
  { label: 'Train', page: 'My workouts', icon: Dumbbell },
  { label: 'Search', page: 'Search', icon: Search },
  { label: 'Message', page: 'Messages', icon: MessageCircle },
  { label: 'Profile', page: 'Profile', icon: UserRound },
]

const workoutLibrary: Workout[] = [
  { id: 'w1', name: 'Strength & power', type: 'STRENGTH', duration: '45 min', level: 'Intermediate', focus: 'Upper body', tag: 'UPPER BODY' },
  { id: 'w2', name: 'HIIT Blast', type: 'HIIT', duration: '30 min', level: 'Advanced', focus: 'Full body', tag: 'CONDITIONING' },
  { id: 'w3', name: 'Mobility & flow', type: 'RECOVERY', duration: '40 min', level: 'All levels', focus: 'Mobility', tag: 'RECOVERY' },
  { id: 'w4', name: 'Core reset', type: 'STRENGTH', duration: '25 min', level: 'Beginner', focus: 'Core', tag: 'CORE' },
  { id: 'w5', name: 'Endurance intervals', type: 'HIIT', duration: '35 min', level: 'Intermediate', focus: 'Cardio', tag: 'ENDURANCE' },
  { id: 'w6', name: 'Evening stretch', type: 'RECOVERY', duration: '20 min', level: 'All levels', focus: 'Flexibility', tag: 'STRETCH' },
]

const sessionPool: Omit<Session, 'id' | 'time'>[] = [
  { name: 'Strength fundamentals', coach: 'Sarah Mitchell', type: 'STRENGTH', duration: '45 min' },
  { name: 'HIIT Blast', coach: 'Marcus Lee', type: 'HIIT', duration: '30 min' },
  { name: 'Mobility & flow', coach: 'Nina Patel', type: 'RECOVERY', duration: '40 min' },
]

const weekTimes: string[][] = [
  ['07:00 AM', '12:15 PM', '06:00 PM'],
  ['06:30 AM', '11:00 AM', '05:30 PM'],
  ['06:30 AM', '08:00 AM', '05:30 PM'],
  ['07:30 AM', '01:00 PM', '06:30 PM'],
  ['06:00 AM', '12:00 PM', '05:00 PM'],
  ['09:00 AM', '11:00 AM'],
  ['09:30 AM', '10:30 AM'],
]

const activitySeries: Record<string, number[]> = {
  'This week': [240, 385, 310, 470, 420, 530, 600],
  'This month': [180, 260, 340, 290, 410, 480, 560],
  'This year': [120, 210, 300, 380, 450, 520, 600],
}

const clubs = ['Downtown Club', 'Riverside Club', 'Northside Club']

const groups = [
  { id: 'g1', name: 'Morning Movers', members: 128, icon: Activity },
  { id: 'g2', name: 'Strength Circle', members: 86, icon: Dumbbell },
  { id: 'g3', name: 'Recovery Room', members: 64, icon: Heart },
]

const leaders = [
  { name: 'Nina Patel', initials: 'NP', points: 980 },
  { name: 'Marcus Lee', initials: 'ML', points: 910 },
  { name: 'Alex Thompson', initials: 'AT', points: 865 },
  { name: 'Sarah Mitchell', initials: 'SM', points: 820 },
]

function weekDate(offset: number, index: number) {
  return new Date(BASE_DATE + (offset * 7 + index - 2) * DAY_MS)
}

function formatWeekRange(offset: number) {
  const start = weekDate(offset, 0)
  const end = weekDate(offset, 6)
  const startMonth = start.toLocaleDateString('en-US', { month: 'long', timeZone: 'UTC' })
  const endMonth = end.toLocaleDateString('en-US', { month: 'long', timeZone: 'UTC' })
  return startMonth === endMonth
    ? `${startMonth} ${start.getUTCDate()} – ${end.getUTCDate()}`
    : `${startMonth} ${start.getUTCDate()} – ${endMonth} ${end.getUTCDate()}`
}

function monthGrid(offset: number) {
  const first = new Date(Date.UTC(2026, 10 + offset, 1))
  const mondayOffset = (first.getUTCDay() + 6) % 7
  const start = new Date(first.getTime() - mondayOffset * DAY_MS)
  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(start.getTime() + index * DAY_MS)
    return { date, inMonth: date.getUTCMonth() === first.getUTCMonth() && date.getUTCFullYear() === first.getUTCFullYear() }
  })
}

function monthTitle(offset: number) {
  return new Date(Date.UTC(2026, 10 + offset, 1)).toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' })
}

function sessionsForDay(day: DayLabel): Session[] {
  const index = DAY_LABELS.indexOf(day)
  const times = weekTimes[index]
  return sessionPool.slice(0, times.length).map((session, sessionIndex) => ({ ...session, id: `s${sessionIndex}`, time: times[sessionIndex] }))
}

function chartPath(values: number[]) {
  const max = 600
  return values
    .map((value, index) => `${index === 0 ? 'M' : 'L'} ${(index / (values.length - 1)) * 600} ${150 - (value / max) * 150}`)
    .join(' ')
}

function toggleValue<T>(set: Set<T>, value: T) {
  const next = new Set(set)
  if (next.has(value)) next.delete(value)
  else next.add(value)
  return next
}

function getInitials(name: string) {
  return name.trim().split(/\s+/).slice(0, 2).map((part) => part.charAt(0).toUpperCase()).join('') || 'AT'
}

function storyTimeAgo(createdAt: string) {
  const minutes = Math.max(0, Math.floor((Date.now() - new Date(createdAt).getTime()) / 60000))
  if (minutes < 1) return 'baru saja'
  if (minutes < 60) return `${minutes} menit lalu`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} jam lalu`
  return `${Math.floor(hours / 24)} hari lalu`
}

function storyRingStyle(items: StoryPost[], viewed: Set<string>): React.CSSProperties {
  const activeGradient = 'linear-gradient(135deg,#b7f34d,#4b7d2f)'
  if (items.length === 0) return { background: 'transparent', padding: 0 }
  const viewedCount = items.filter((story) => viewed.has(story.id)).length
  if (viewedCount === 0) return { background: activeGradient }
  if (viewedCount === items.length) return { background: 'var(--story-viewed)' }
  const color = (story: StoryPost) => viewed.has(story.id) ? 'var(--story-viewed)' : '#b7f34d'
  const step = 360 / items.length
  const gap = Math.min(6, step / 4)
  const stops: string[] = []
  items.forEach((story, index) => {
    const start = index * step
    const end = start + step - gap
    stops.push(`${color(story)} ${start}deg ${end}deg`)
    stops.push(`var(--story-gap) ${end}deg ${start + step}deg`)
  })
  return { background: `conic-gradient(${stops.join(',')})` }
}

async function apiFetch<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...init?.headers },
  })
  const data = await response.json().catch(() => ({})) as Record<string, unknown>
  if (!response.ok) throw new Error(typeof data.error === 'string' ? data.error : 'Permintaan gagal.')
  return data as T
}

async function readImage(file: File, size = 256): Promise<string> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(new Error('Gagal membaca gambar.'))
    reader.readAsDataURL(file)
  })
  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const element = new Image()
    element.onload = () => resolve(element)
    element.onerror = () => reject(new Error('Gambar tidak valid.'))
    element.src = dataUrl
  })
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const context = canvas.getContext('2d')
  if (!context) throw new Error('Browser tidak mendukung pengolahan gambar.')
  const crop = Math.min(image.width, image.height)
  context.drawImage(image, (image.width - crop) / 2, (image.height - crop) / 2, crop, crop, 0, 0, size, size)
  return canvas.toDataURL('image/jpeg', 0.82)
}

function loadGoogleScript() {
  if (window.google?.accounts?.oauth2) return Promise.resolve()
  if (!googleScriptPromise) {
    googleScriptPromise = new Promise<void>((resolve, reject) => {
      const script = document.createElement('script')
      script.src = 'https://accounts.google.com/gsi/client'
      script.async = true
      script.defer = true
      script.onload = () => resolve()
      script.onerror = () => {
        googleScriptPromise = null
        reject(new Error('Gagal memuat Google Sign-In.'))
      }
      document.head.appendChild(script)
    })
  }
  return googleScriptPromise
}

function Dashboard({ user, theme, onThemeChange, onSignOut, onUserChange, onUpdateUser }: DashboardProps) {
  const userInitials = getInitials(user.name)
  const firstName = user.name.trim().split(/\s+/)[0] || 'member'
  const [active, setActive] = useState<Page>('Overview')
  const [selectedDay, setSelectedDay] = useState<DayLabel>('WED')
  const [weekOffset, setWeekOffset] = useState(0)
  const [booked, setBooked] = useState<Set<string>>(new Set())
  const [startedWorkouts, setStartedWorkouts] = useState<Set<string>>(new Set())
  const [completedWorkouts, setCompletedWorkouts] = useState<Set<string>>(new Set())
  const [joinedGroups, setJoinedGroups] = useState<Set<string>>(new Set())
  const [likedPosts, setLikedPosts] = useState<Set<number>>(new Set())
  const [menuOpen, setMenuOpen] = useState(false)
  const [clubOpen, setClubOpen] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)
  const [calendarOpen, setCalendarOpen] = useState(false)
  const [calendarOffset, setCalendarOffset] = useState(0)
  const [searchQuery, setSearchQuery] = useState('')
  const [communityPosts, setCommunityPosts] = useState<CommunityPost[]>([])
  const [searchFilter, setSearchFilter] = useState('ALL')
  const [filterOpen, setFilterOpen] = useState(false)
  const [activityRange, setActivityRange] = useState('This week')
  const [workoutFilter, setWorkoutFilter] = useState<'ALL' | WorkoutType>('ALL')
  const [classFilter, setClassFilter] = useState<'ALL' | WorkoutType>('ALL')
  const [onlyBooked, setOnlyBooked] = useState(false)
  const [modal, setModal] = useState<Modal>(null)
  const [toast, setToast] = useState<{ id: number; message: string } | null>(null)
  const [club, setClub] = useState(user.club)
  const [weeklyGoal, setWeeklyGoal] = useState(5)
  const [goalInput, setGoalInput] = useState('5')
  const [challengeJoined, setChallengeJoined] = useState(false)
  const [newWorkout, setNewWorkout] = useState({ name: '', type: 'STRENGTH' as WorkoutType, duration: '30 min', level: 'Beginner' })
  const [customWorkouts, setCustomWorkouts] = useState<Workout[]>([])
  const [settings, setSettings] = useState({ notifications: true, reminders: true, units: 'Metric', club: user.club })
  const [profile, setProfile] = useState({ name: user.name, email: user.email, goal: 'Build consistent strength', bio: user.bio && user.bio !== `${user.club} · Premium member since 2022` ? user.bio : '' })
  const [posts, setPosts] = useState([
    { id: 1, author: 'Nina Patel', initials: 'NP', text: 'Five morning flows in a row. Small steps really do add up.', time: '12 min ago', likes: 12 },
    { id: 2, author: 'Marcus Lee', initials: 'ML', text: 'Who is joining the Saturday conditioning session?', time: '48 min ago', likes: 8 },
  ])
  const [postText, setPostText] = useState('')
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    { id: 1, from: 'coach', text: `Hi ${firstName}, I reviewed your plan for this week. Your strength sessions are looking consistent.`, time: '8:42 AM' },
    { id: 2, from: 'me', text: 'Thanks Sarah! I felt stronger on the last session.', time: '9:05 AM' },
    { id: 3, from: 'coach', text: 'That is great to hear. Keep the recovery day easy and we will progress the load next week.', time: '9:11 AM' },
  ])
  const [chatInput, setChatInput] = useState('')
  const [passwordForm, setPasswordForm] = useState({ currentPassword: '', newPassword: '' })
  const [photoPreviews, setPhotoPreviews] = useState<string[]>([])
  const [previewIndex, setPreviewIndex] = useState(0)
  const [photoCaption, setPhotoCaption] = useState('')
  const [selectedPhotoId, setSelectedPhotoId] = useState<string | null>(null)
  const [activeSlides, setActiveSlides] = useState<Record<string, number>>({})
  const [expandedCaptions, setExpandedCaptions] = useState<Record<string, boolean>>({})
  const [activeStory, setActiveStory] = useState<StoryPost | null>(null)
  const [holdingStory, setHoldingStory] = useState(false)
  const [viewedStories, setViewedStories] = useState<Set<string>>(new Set())
  const avatarInputRef = useRef<HTMLInputElement>(null)
  const postInputRef = useRef<HTMLInputElement>(null)
  const storyInputRef = useRef<HTMLInputElement>(null)
  const holdTimerRef = useRef<number | null>(null)
  const heldRef = useRef(false)
  const elapsedRef = useRef(0)
  const startedAtRef = useRef(Date.now())
  const stories = useMemo(() => user.stories ?? [], [user.stories])
  const orderedStories = useMemo(() => [...stories].reverse(), [stories])

  useEffect(() => {
    setProfile((current) => ({ ...current, name: user.name, email: user.email, bio: user.bio ?? '' }))
    setClub(user.club)
    setSettings((current) => ({ ...current, club: user.club }))
  }, [user.name, user.email, user.bio, user.club])

  useEffect(() => {
    elapsedRef.current = 0
    startedAtRef.current = Date.now()
  }, [activeStory])

  useEffect(() => {
    if (!activeStory || viewedStories.has(activeStory.id)) return
    setViewedStories((current) => new Set(current).add(activeStory.id))
  }, [activeStory, viewedStories])

  useEffect(() => {
    if (!activeStory || holdingStory) return
    const remaining = Math.max(0, 5000 - elapsedRef.current)
    const timer = window.setTimeout(() => {
      const index = orderedStories.findIndex((item) => item.id === activeStory.id)
      setActiveStory(index >= 0 && index < orderedStories.length - 1 ? orderedStories[index + 1] : null)
    }, remaining)
    return () => window.clearTimeout(timer)
  }, [activeStory, orderedStories, holdingStory])

  useEffect(() => () => {
    if (holdTimerRef.current) window.clearTimeout(holdTimerRef.current)
  }, [])

  useEffect(() => {
    let active = true
    const load = async () => {
      try {
        const params = new URLSearchParams()
        if (searchFilter !== 'ALL') params.set('category', searchFilter)
        if (searchQuery.trim()) params.set('q', searchQuery.trim())
        const query = params.toString()
        const data = await apiFetch<{ posts: RawCommunityPost[] }>(`/api/community-posts${query ? `?${query}` : ''}`)
        if (active) setCommunityPosts(data.posts.map(normalizeCommunityPost))
      } catch {
        if (active) setCommunityPosts([])
      }
    }
    void load()
    window.addEventListener('forma:community-posts', load)
    return () => {
      active = false
      window.removeEventListener('forma:community-posts', load)
    }
  }, [searchQuery, searchFilter])

  const notify = useCallback((message: string) => {
    setToast({ id: Date.now() + Math.random(), message })
  }, [])

  const avatarContent = user.avatar ? <img src={user.avatar} alt="" /> : userInitials
  const photos = user.photos ?? []
  const selectedPhotoIndex = photos.findIndex((post) => post.id === selectedPhotoId)
  const visiblePhotos = selectedPhotoIndex >= 0 ? photos.slice(selectedPhotoIndex) : []

  const handleAvatarChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    if (!file.type.startsWith('image/')) {
      notify('Pilih file gambar.')
      return
    }
    try {
      const avatar = await readImage(file, 256)
      await onUpdateUser({ avatar })
      notify('Foto profil diperbarui')
    } catch (cause) {
      notify(cause instanceof Error ? cause.message : 'Gagal memperbarui foto profil.')
    }
  }

  const handleStoryChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    if (!file.type.startsWith('image/')) {
      notify('Pilih file gambar.')
      return
    }
    try {
      const image = await readImage(file, 720)
      const created = await apiFetch<{ story: RawStory }>('/api/stories', {
        method: 'POST',
        body: JSON.stringify({ mediaUrl: image }),
      })
      const data = await apiFetch<{ stories: RawStory[] }>('/api/stories')
      onUserChange({ ...user, stories: data.stories.map(normalizeStory) })
      setActiveStory(normalizeStory(created.story))
      notify('Story dibuat')
    } catch (cause) {
      notify(cause instanceof Error ? cause.message : 'Gagal membuat story.')
    }
  }

  const stepStory = (delta: number) => {
    const index = orderedStories.findIndex((item) => item.id === activeStory?.id)
    const next = index + delta
    if (next < 0) return
    setActiveStory(next >= orderedStories.length ? null : orderedStories[next])
  }

  const deleteStory = async () => {
    if (!activeStory) return
    const index = orderedStories.findIndex((item) => item.id === activeStory.id)
    const next = orderedStories[index + 1] ?? orderedStories[index - 1] ?? null
    try {
      const data = await apiFetch<UserResponse>(`/api/stories/${activeStory.id}`, { method: 'DELETE' })
      onUserChange(data.user)
      setActiveStory(next)
      notify('Story dihapus')
    } catch (cause) {
      notify(cause instanceof Error ? cause.message : 'Gagal menghapus story.')
    }
  }

  const startStoryPress = (event: React.PointerEvent<HTMLDivElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId)
    heldRef.current = false
    if (holdTimerRef.current) window.clearTimeout(holdTimerRef.current)
    holdTimerRef.current = window.setTimeout(() => {
      heldRef.current = true
      elapsedRef.current += Date.now() - startedAtRef.current
      setHoldingStory(true)
    }, 350)
  }

  const endStoryPress = (event: React.PointerEvent<HTMLDivElement>) => {
    if (holdTimerRef.current) {
      window.clearTimeout(holdTimerRef.current)
      holdTimerRef.current = null
    }
    if (heldRef.current) {
      startedAtRef.current = Date.now()
      setHoldingStory(false)
      heldRef.current = false
      return
    }
    const rect = event.currentTarget.getBoundingClientRect()
    stepStory(event.clientX < rect.left + rect.width / 2 ? -1 : 1)
  }

  const cancelStoryPress = () => {
    if (holdTimerRef.current) {
      window.clearTimeout(holdTimerRef.current)
      holdTimerRef.current = null
    }
    if (heldRef.current) {
      startedAtRef.current = Date.now()
      setHoldingStory(false)
      heldRef.current = false
    }
  }

  const handlePhotoChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? [])
    event.target.value = ''
    if (!files.length) return
    const imageFiles = files.filter((file) => file.type.startsWith('image/'))
    if (!imageFiles.length) {
      notify('Pilih file gambar.')
      return
    }
    const available = Math.max(0, MAX_POST_IMAGES - photoPreviews.length)
    const selected = imageFiles.slice(0, available)
    if (imageFiles.length > available) notify(`Maksimal ${MAX_POST_IMAGES} gambar per post.`)
    if (!selected.length) return
    try {
      const loaded = await Promise.all(selected.map((file) => readImage(file, 640)))
      setPhotoPreviews((current) => [...current, ...loaded].slice(0, MAX_POST_IMAGES))
    } catch (cause) {
      notify(cause instanceof Error ? cause.message : 'Gagal memuat foto.')
    }
  }

  const handlePhotoSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!photoPreviews.length) return false
    try {
      await apiFetch<{ photo: { id: string } }>('/api/photos', {
        method: 'POST',
        body: JSON.stringify({ images: photoPreviews, caption: photoCaption.trim() }),
      })
      const data = await apiFetch<{ photos: RawPhoto[] }>('/api/photos')
      onUserChange({ ...user, photos: data.photos.map(normalizePhoto) })
      setPhotoPreviews([])
      setPreviewIndex(0)
      setPhotoCaption('')
      notify('Foto berhasil diposting')
      return true
    } catch (cause) {
      notify(cause instanceof Error ? cause.message : 'Gagal memposting foto.')
      return false
    }
  }

  const handlePreviewScroll = (event: React.UIEvent<HTMLDivElement>) => {
    const element = event.currentTarget
    const index = Math.round(element.scrollLeft / element.clientWidth)
    setPreviewIndex((current) => current === index ? current : index)
  }

  const handleSlideScroll = (postId: string, event: React.UIEvent<HTMLDivElement>) => {
    const element = event.currentTarget
    const index = Math.round(element.scrollLeft / element.clientWidth)
    setActiveSlides((current) => current[postId] === index ? current : { ...current, [postId]: index })
  }

  const handleChatSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const text = chatInput.trim()
    if (!text) return
    setChatMessages((current) => [...current, { id: Date.now(), from: 'me', text, time: 'Baru saja' }])
    setChatInput('')
  }

  const submitCommunityPost = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const text = postText.trim()
    if (!text) return
    try {
      await apiFetch<{ post: { id: string } }>('/api/community-posts', {
        method: 'POST',
        body: JSON.stringify({ category: 'STRENGTH', imageUrl: textPostImage(text), caption: text }),
      })
      setPosts((current) => [{ id: Date.now(), author: profile.name, initials: userInitials, text, time: 'Just now', likes: 0 }, ...current])
      setPostText('')
      window.dispatchEvent(new Event('forma:community-posts'))
      notify('Your post is live')
    } catch (cause) {
      notify(cause instanceof Error ? cause.message : 'Gagal mengirim postingan.')
    }
  }

  const togglePhotoLike = async (id: string) => {
    const post = photos.find((item) => item.id === id)
    if (!post) return
    try {
      const data = await apiFetch<UserResponse>(`/api/photos/${id}/like`, {
        method: 'POST',
        body: JSON.stringify({ liked: !post.liked }),
      })
      onUserChange(data.user)
    } catch (cause) {
      notify(cause instanceof Error ? cause.message : 'Gagal memperbarui suka.')
    }
  }

  const sharePhoto = async (post: PhotoPost) => {
    const text = post.caption ? `${post.caption} — Forma Athletic Club` : 'Forma Athletic Club'
    if (navigator.share) {
      try {
        await navigator.share({ title: 'Forma Athletic Club', text })
        return
      } catch {
        notify('Bagikan dibatalkan')
        return
      }
    }
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(text).then(() => notify('Caption disalin')).catch(() => notify(text))
    } else {
      notify(text)
    }
  }

  const handlePasswordSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    try {
      await apiFetch<{ ok: boolean }>('/api/auth/password', {
        method: 'POST',
        body: JSON.stringify(passwordForm),
      })
      setPasswordForm({ currentPassword: '', newPassword: '' })
      setModal(null)
      notify('Kata sandi diperbarui')
    } catch (cause) {
      notify(cause instanceof Error ? cause.message : 'Gagal memperbarui kata sandi.')
    }
  }

  const goTo = useCallback((page: Page) => {
    setActive(page)
    setMenuOpen(false)
    setClubOpen(false)
    setProfileOpen(false)
    setCalendarOpen(false)
    setModal(null)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [])

  useEffect(() => {
    if (!toast) return
    const timer = window.setTimeout(() => setToast(null), 2800)
    return () => window.clearTimeout(timer)
  }, [toast])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        setSearchQuery('')
        goTo('Search')
      }
      if (event.key === 'Escape') {
        setModal(null)
        setClubOpen(false)
        setProfileOpen(false)
        setCalendarOpen(false)
        setMenuOpen(false)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  const allWorkouts = useMemo(() => [...workoutLibrary, ...customWorkouts], [customWorkouts])
  const sessions = useMemo(() => sessionsForDay(selectedDay), [selectedDay])
  const bookingKey = (session: Session) => `${weekOffset}-${selectedDay}-${session.id}`
  const isBooked = (session: Session) => booked.has(bookingKey(session))

  const visibleWorkouts = allWorkouts.filter((workout) => workoutFilter === 'ALL' || workout.type === workoutFilter)
  const visibleSessions = sessions.filter((session) =>
    (classFilter === 'ALL' || session.type === classFilter) && (!onlyBooked || isBooked(session)))
  const completionPercent = Math.min(100, 78 + completedWorkouts.size * 4)
  const workoutCount = 4 + completedWorkouts.size
  const chartValues = activitySeries[activityRange]
  const line = chartPath(chartValues)
  const area = `${line} V150 H0 Z`
  const popoverOpen = clubOpen || profileOpen || calendarOpen

  const handleWorkout = (workout: Workout) => {
    if (completedWorkouts.has(workout.id)) {
      notify(`${workout.name} is already in your log`)
      return
    }
    if (startedWorkouts.has(workout.id)) {
      setCompletedWorkouts((current) => new Set(current).add(workout.id))
      setStartedWorkouts((current) => toggleValue(current, workout.id))
      notify(`${workout.name} completed. Nice work!`)
      return
    }
    setStartedWorkouts((current) => new Set(current).add(workout.id))
    notify(`${workout.name} started. Let's go!`)
  }

  const handleBooking = (session: Session) => {
    const key = bookingKey(session)
    setBooked((current) => toggleValue(current, key))
    notify(booked.has(key) ? `${session.name} booking cancelled` : `${session.name} booked for ${selectedDay}`)
  }

  const openCoach = () => {
    goTo('Messages')
  }

  const exportReport = () => {
    const rows = [
      ['Metric', 'Value'],
      ['Weekly workouts', `${workoutCount}/${weeklyGoal}`],
      ['Goal completion', `${completionPercent}%`],
      ['Current streak', '12 days'],
      ['Activity range', activityRange],
      ...chartValues.map((value, index) => [`${activityRange} point ${index + 1}`, String(value)]),
    ]
    const url = URL.createObjectURL(new Blob([rows.map((row) => row.join(',')).join('\n')], { type: 'text/csv' }))
    const link = document.createElement('a')
    link.href = url
    link.download = 'forma-progress.csv'
    link.click()
    URL.revokeObjectURL(url)
    notify('Progress report downloaded')
  }

  const shareProgress = () => {
    const text = `I'm on a 12-day streak and ${completionPercent}% toward my weekly goal at Forma Athletic Club.`
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(text).then(() => notify('Progress copied to clipboard')).catch(() => notify(text))
    } else {
      notify(text)
    }
  }

  const renderOverview = () => (
    <>
      <div className="welcome-row"><div><div className="eyebrow"><span className="live-dot" /> WEDNESDAY, NOVEMBER 18, 2026</div><h1>Good morning, {firstName} <Sparkles size={17} aria-hidden="true" /></h1><p>You&apos;re building a habit that lasts. Let&apos;s make today count.</p></div><div className="view-actions"><button className="outline-button" onClick={() => goTo('Class schedule')}><CalendarDays size={16} /> Class schedule</button><button className="outline-button" onClick={() => { setCalendarOpen(!calendarOpen); setCalendarOffset(0) }}><CalendarDays size={16} /> View calendar <ChevronDown size={14} /></button></div></div>

      <div className="metrics-grid">
        <article className="metric-card"><div className="metric-top"><span>WEEKLY WORKOUTS</span><span className="metric-icon lime"><Dumbbell size={16} /></span></div><strong>{String(workoutCount).padStart(2, '0')} <small>/ {String(weeklyGoal).padStart(2, '0')}</small></strong><div className="metric-foot"><span className="positive"><TrendingUp size={13} /> +1 this week</span><div className="mini-bars"><i /><i /><i /><i /><i /><i /><i /></div></div></article>
        <article className="metric-card"><div className="metric-top"><span>CALORIES BURNED</span><span className="metric-icon orange"><Flame size={16} /></span></div><strong>2,450 <small>kcal</small></strong><div className="metric-foot"><span className="positive"><TrendingUp size={13} /> 12% vs last week</span><div className="sparkline"><svg viewBox="0 0 110 30" preserveAspectRatio="none"><path d="M0 24 C12 21, 15 8, 26 16 S42 24, 52 13 S68 10, 76 17 S91 3, 110 8" /></svg></div></div></article>
        <article className="metric-card"><div className="metric-top"><span>ACTIVE TIME</span><span className="metric-icon blue"><Clock3 size={16} /></span></div><strong>8h 30m</strong><div className="metric-foot"><span className="muted">of 10h weekly goal</span><div className="progress-track"><i style={{ width: '72%' }} /></div></div></article>
        <article className="metric-card goal-card"><div className="metric-top"><span>GOAL COMPLETION</span><span className="metric-icon violet"><Target size={16} /></span></div><div className="goal-row"><strong>{completionPercent}<small>%</small></strong><div className="goal-ring" style={{ background: `conic-gradient(#b7f34d 0 ${completionPercent}%,var(--goal-track) ${completionPercent}%)` }}><span>{completionPercent}%</span></div></div><div className="metric-foot"><button className="inline-link" onClick={() => goTo('Progress')}>You&apos;re on track!</button><span className="muted">3 goals left</span></div></article>
      </div>

      <div className="dashboard-grid">
        <div className="left-column">
          <section className="panel plan-panel"><div className="section-heading"><div><span className="eyebrow">YOUR PERSONALIZED PLAN</span><h2>Today&apos;s focus</h2></div><button className="text-button" onClick={() => goTo('My workouts')}>Full plan <ArrowRight size={14} /></button></div>
            <div className="feature-workout"><div className="workout-copy"><span className="workout-tag"><Dumbbell size={12} /> UPPER BODY</span><h3>Strength<br />&amp; power</h3><p>Build strength, one rep at a time.</p><div className="workout-meta"><span><Clock3 size={14} /> 45 min</span><i /> <span>Intermediate</span></div><button className="primary-button" onClick={() => handleWorkout(allWorkouts[0])}>{completedWorkouts.has('w1') ? 'Workout complete' : startedWorkouts.has('w1') ? 'Finish workout' : 'Start workout'} <span>{completedWorkouts.has('w1') ? <Check size={19} /> : <CirclePlay size={19} />}</span></button></div><div className="workout-image" role="img" aria-label="Athlete training with dumbbells" /></div>
          </section>
          <section className="panel activity-panel"><div className="section-heading"><div><span className="eyebrow">YOUR LAST 7 DAYS</span><h2>Activity overview</h2></div><button className="select-button" onClick={() => { const options = Object.keys(activitySeries); const next = options[(options.indexOf(activityRange) + 1) % options.length]; setActivityRange(next); notify(`Activity view: ${next}`) }}>{activityRange} <ChevronDown size={14} /></button></div><div className="activity-chart"><div className="chart-y"><span>600</span><span>400</span><span>200</span><span>0</span></div><div className="chart-area"><div className="grid-lines"><i /><i /><i /><i /></div><svg className="chart-line" viewBox="0 0 600 150" preserveAspectRatio="none" aria-label="Weekly activity chart"><defs><linearGradient id="area" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="#b7f34d" stopOpacity=".23" /><stop offset="1" stopColor="#b7f34d" stopOpacity="0" /></linearGradient></defs><path className="chart-fill" d={area} /><path className="chart-stroke" d={line} /></svg><div className="chart-x">{DAY_LABELS.map((day) => <span key={day}>{day.charAt(0) + day.slice(1).toLowerCase()}</span>)}</div></div></div></section>
        </div>
        <div className="right-column">
          <section className="panel schedule-panel"><div className="section-heading"><div><span className="eyebrow">MAKE TIME FOR YOU</span><h2>Upcoming classes</h2></div><button className="round-arrow" aria-label="See all classes" onClick={() => goTo('Class schedule')}><ArrowRight size={15} /></button></div><div className="schedule-date"><span>THIS WEEK</span><button onClick={() => { setWeekOffset(weekOffset + 1); notify(`Showing ${formatWeekRange(weekOffset + 1)}`) }}>{formatWeekRange(weekOffset)} <ChevronDown size={13} /></button></div><div className="week-strip">{DAY_LABELS.map((day, index) => <button key={day} onClick={() => setSelectedDay(day)} className={selectedDay === day ? 'day active-day' : 'day'}><span>{day}</span><b>{weekDate(weekOffset, index).getUTCDate()}</b></button>)}</div><div className="class-list">{sessions.map((session, index) => <article className="class-row" key={session.id}><div className="class-time"><strong>{session.time}</strong><span>{session.duration}</span></div><div className="class-marker"><i /></div><div className="class-info"><span className={`class-type type-${index}`}>{session.type}</span><strong>{session.name}</strong><small>with {session.coach}</small></div><button className={isBooked(session) ? 'join-button joined' : 'join-button'} onClick={() => handleBooking(session)}>{isBooked(session) ? 'Joined' : 'Join'}</button></article>)}</div><button className="schedule-link" onClick={() => goTo('Class schedule')}>Explore all classes <ArrowRight size={14} /></button></section>
          <button className="coach-note note-button" onClick={openCoach}><div className="note-icon"><Sparkles size={17} /></div><div><span>NOTE FROM SARAH</span><p>Consistency beats intensity. Proud of the progress you&apos;re making, {firstName}.</p><small>Today, 8:42 AM</small></div><ArrowDownRight size={16} /></button>
          <section className="streak-card"><div className="streak-top"><div><span className="eyebrow">CURRENT STREAK</span><h2>12 days <Flame size={18} /></h2></div><div className="streak-badge">ON FIRE</div></div><div className="streak-days">{['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((day, index) => <div key={index} className={index < 4 ? 'streak-done' : ''}><span>{day}</span><i>{index < 4 ? <span>✓</span> : null}</i></div>)}</div><div className="streak-foot"><p><Footprints size={13} /> 2 more days to beat your record</p><button className="text-button" onClick={() => goTo('Progress')}>See progress <ArrowRight size={14} /></button></div></section>
        </div>
      </div>
    </>
  )

  const renderWorkouts = () => (
    <>
      <div className="view-heading"><div><span className="eyebrow">YOUR TRAINING LIBRARY</span><h1>My workouts</h1><p>Start a session, track your log, and build your own plan.</p></div><div className="view-actions"><button className="outline-button" onClick={() => goTo('Progress')}><TrendingUp size={16} /> Progress</button><button className="primary-button view-primary" onClick={() => setModal('create')}><Plus size={16} /> New workout</button></div></div>
      <div className="filter-row">{(['ALL', 'STRENGTH', 'HIIT', 'RECOVERY'] as const).map((filter) => <button key={filter} className={workoutFilter === filter ? 'filter-chip active' : 'filter-chip'} onClick={() => setWorkoutFilter(filter)}>{filter === 'ALL' ? 'All workouts' : filter}</button>)}</div>
      <div className="workout-grid">{visibleWorkouts.map((workout) => {
        const done = completedWorkouts.has(workout.id)
        const started = startedWorkouts.has(workout.id)
        return <article className="workout-card" key={workout.id}><div className="workout-card-top"><span className={`class-type type-${workout.type === 'STRENGTH' ? 0 : workout.type === 'HIIT' ? 1 : 2}`}>{workout.type}</span><span className="workout-duration"><Clock3 size={13} /> {workout.duration}</span></div><h2>{workout.name}</h2><p>{workout.focus} · {workout.level}</p><div className="workout-progress"><i style={{ width: done ? '100%' : started ? '45%' : '0%' }} /></div><div className="workout-card-foot"><span>{done ? 'Logged' : started ? 'In progress' : 'Ready'}</span><button className="primary-button small" onClick={() => handleWorkout(workout)}>{done ? <Check size={14} /> : started ? <ArrowRight size={14} /> : <CirclePlay size={14} />}{done ? 'Completed' : started ? 'Finish' : 'Start'}</button></div></article>
      })}</div>
      {visibleWorkouts.length === 0 && <div className="empty-state"><Dumbbell size={24} /><p>No workouts match this filter.</p><button className="text-button" onClick={() => setWorkoutFilter('ALL')}>Show all <ArrowRight size={14} /></button></div>}
    </>
  )

  const renderSchedule = () => (
    <>
      <div className="view-heading"><div><span className="eyebrow">PLAN YOUR WEEK</span><h1>Class schedule</h1><p>Book a class, change your day, or review your reservations.</p></div><button className="outline-button" onClick={() => { setOnlyBooked(!onlyBooked); notify(onlyBooked ? 'Showing all classes' : 'Showing your bookings') }}><CalendarDays size={16} /> {onlyBooked ? 'All classes' : 'My bookings'}</button></div>
      <section className="panel schedule-page"><div className="week-nav"><button className="round-arrow" aria-label="Previous week" onClick={() => { setWeekOffset(weekOffset - 1); notify(`Showing ${formatWeekRange(weekOffset - 1)}`) }}><ArrowLeft size={15} /></button><strong>{formatWeekRange(weekOffset)}</strong><button className="round-arrow" aria-label="Next week" onClick={() => { setWeekOffset(weekOffset + 1); notify(`Showing ${formatWeekRange(weekOffset + 1)}`) }}><ArrowRight size={15} /></button></div><div className="week-strip wide">{DAY_LABELS.map((day, index) => <button key={day} onClick={() => setSelectedDay(day)} className={selectedDay === day ? 'day active-day' : 'day'}><span>{day}</span><b>{weekDate(weekOffset, index).getUTCDate()}</b></button>)}</div><div className="filter-row">{(['ALL', 'STRENGTH', 'HIIT', 'RECOVERY'] as const).map((filter) => <button key={filter} className={classFilter === filter ? 'filter-chip active' : 'filter-chip'} onClick={() => setClassFilter(filter)}>{filter === 'ALL' ? 'All classes' : filter}</button>)}</div>
        <div className="class-list page-list">{visibleSessions.map((session, index) => <article className="class-row" key={session.id}><div className="class-time"><strong>{session.time}</strong><span>{session.duration}</span></div><div className="class-marker"><i /></div><div className="class-info"><span className={`class-type type-${index}`}>{session.type}</span><strong>{session.name}</strong><small>with {session.coach}</small></div><button className={isBooked(session) ? 'join-button joined' : 'join-button'} onClick={() => handleBooking(session)}>{isBooked(session) ? 'Booked' : 'Book'}</button></article>)}</div>
        {visibleSessions.length === 0 && <div className="empty-state"><CalendarDays size={24} /><p>No classes match these filters.</p><button className="text-button" onClick={() => { setClassFilter('ALL'); setOnlyBooked(false) }}>Clear filters <ArrowRight size={14} /></button></div>}
      </section>
      <div className="info-strip"><span><Check size={15} /> {booked.size} class{booked.size === 1 ? '' : 'es'} booked</span><button className="text-button" onClick={() => goTo('Overview')}>Back to overview <ArrowRight size={14} /></button></div>
    </>
  )

  const renderProgress = () => (
    <>
      <div className="view-heading"><div><span className="eyebrow">YOUR RESULTS</span><h1>Progress</h1><p>See how your consistency is paying off.</p></div><div className="view-actions"><button className="outline-button" onClick={exportReport}><Download size={15} /> Export report</button><button className="outline-button" onClick={shareProgress}><Share2 size={15} /> Share</button></div></div>
      <div className="metrics-grid">
        <article className="metric-card"><div className="metric-top"><span>WORKOUTS LOGGED</span><span className="metric-icon lime"><Dumbbell size={16} /></span></div><strong>{String(workoutCount).padStart(2, '0')} <small>/ {String(weeklyGoal).padStart(2, '0')}</small></strong><div className="metric-foot"><span className="positive">Goal in reach</span></div></article>
        <article className="metric-card"><div className="metric-top"><span>GOAL COMPLETION</span><span className="metric-icon violet"><Target size={16} /></span></div><strong>{completionPercent}<small>%</small></strong><div className="metric-foot"><button className="inline-link" onClick={() => { setGoalInput(String(weeklyGoal)); setModal('goal') }}>Adjust goal</button></div></article>
        <article className="metric-card"><div className="metric-top"><span>CURRENT STREAK</span><span className="metric-icon orange"><Flame size={16} /></span></div><strong>12 <small>days</small></strong><div className="metric-foot"><span className="positive">Personal best: 14 days</span></div></article>
        <article className="metric-card"><div className="metric-top"><span>ACTIVE TIME</span><span className="metric-icon blue"><Clock3 size={16} /></span></div><strong>8h 30m</strong><div className="metric-foot"><span className="muted">of 10h weekly goal</span></div></article>
      </div>
      <section className="panel progress-chart-panel"><div className="section-heading"><div><span className="eyebrow">ACTIVITY TREND</span><h2>{activityRange}</h2></div><div className="segmented">{Object.keys(activitySeries).map((range) => <button key={range} className={activityRange === range ? 'segment active' : 'segment'} onClick={() => setActivityRange(range)}>{range}</button>)}</div></div><div className="activity-chart"><div className="chart-y"><span>600</span><span>400</span><span>200</span><span>0</span></div><div className="chart-area"><div className="grid-lines"><i /><i /><i /><i /></div><svg className="chart-line" viewBox="0 0 600 150" preserveAspectRatio="none" aria-label="Activity trend"><defs><linearGradient id="areaProgress" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="#b7f34d" stopOpacity=".23" /><stop offset="1" stopColor="#b7f34d" stopOpacity="0" /></linearGradient></defs><path d={area.replace('url(#area)', 'url(#areaProgress)')} fill="url(#areaProgress)" /><path className="chart-stroke" d={line} /></svg><div className="chart-x">{chartValues.map((_, index) => <span key={index}>{index + 1}</span>)}</div></div></div></section>
      <div className="progress-bottom"><section className="panel record-panel"><div className="section-heading"><div><span className="eyebrow">PERSONAL RECORDS</span><h2>Your best numbers</h2></div><Trophy size={18} className="gold" /></div><div className="record-list"><div><span>Bench press</span><strong>72 kg</strong></div><div><span>5 km run</span><strong>28:14</strong></div><div><span>Longest plank</span><strong>3 min 20s</strong></div><div><span>Weekly active time</span><strong>9h 05m</strong></div></div></section><section className="panel goal-panel"><div className="section-heading"><div><span className="eyebrow">WEEKLY TARGET</span><h2>{weeklyGoal} workouts</h2></div><Target size={18} className="lime-text" /></div><p>Complete {Math.max(0, weeklyGoal - workoutCount)} more workout{weeklyGoal - workoutCount === 1 ? '' : 's'} to hit your target.</p><div className="goal-ring large" style={{ background: `conic-gradient(#b7f34d 0 ${Math.min(100, (workoutCount / weeklyGoal) * 100)}%,var(--goal-track) ${Math.min(100, (workoutCount / weeklyGoal) * 100)}%)` }}><span>{Math.round((workoutCount / weeklyGoal) * 100)}%</span></div><button className="primary-button small goal-button" onClick={() => { setGoalInput(String(weeklyGoal)); setModal('goal') }}>Update goal <ArrowRight size={14} /></button></section></div>
    </>
  )

  const renderCommunity = () => (
    <>
      <div className="view-heading"><div><span className="eyebrow">TRAIN TOGETHER</span><h1>Community</h1><p>Share wins, join groups, and keep each other moving.</p></div><button className="primary-button view-primary" onClick={() => setChallengeJoined(!challengeJoined)}>{challengeJoined ? <Check size={16} /> : <Trophy size={16} />}{challengeJoined ? 'Challenge joined' : 'Join challenge'}</button></div>
      <div className="community-grid"><div className="community-main"><section className="panel feed-panel"><div className="section-heading"><div><span className="eyebrow">CLUB FEED</span><h2>Latest from your club</h2></div></div><form className="post-form" onSubmit={submitCommunityPost}><div className="avatar">{avatarContent}</div><input aria-label="Write a post" placeholder="Share a win or ask a question..." value={postText} onChange={(event) => setPostText(event.target.value)} /><button className="primary-button small" type="submit" disabled={!postText.trim()}><Send size={14} /> Post</button></form><div className="post-list">{posts.map((post) => <article className="post" key={post.id}><div className="avatar">{post.initials}</div><div className="post-body"><div className="post-head"><strong>{post.author}</strong><span>{post.time}</span></div><p>{post.text}</p><button className={likedPosts.has(post.id) ? 'like-button liked' : 'like-button'} onClick={() => setLikedPosts((current) => toggleValue(current, post.id))}><Heart size={13} /> {post.likes + (likedPosts.has(post.id) ? 1 : 0)}</button></div></article>)}</div></section>
          <section className="panel groups-panel"><div className="section-heading"><div><span className="eyebrow">GROUPS</span><h2>Find your people</h2></div></div><div className="group-grid">{groups.map((group) => <article className="group-card" key={group.id}><span className="group-icon"><group.icon size={17} /></span><strong>{group.name}</strong><small>{group.members} members</small><button className={joinedGroups.has(group.id) ? 'join-button joined' : 'join-button'} onClick={() => { setJoinedGroups((current) => toggleValue(current, group.id)); notify(joinedGroups.has(group.id) ? `Left ${group.name}` : `Joined ${group.name}`) }}>{joinedGroups.has(group.id) ? 'Joined' : 'Join'}</button></article>)}</div></section>
        </div>
        <div className="community-side"><section className="panel leaderboard"><div className="section-heading"><div><span className="eyebrow">THIS MONTH</span><h2>Leaderboard</h2></div><Trophy size={17} className="gold" /></div><div className="leader-list">{leaders.map((leader, index) => <div className="leader-row" key={leader.name}><span className="leader-rank">{index + 1}</span><div className="avatar">{leader.initials}</div><strong>{leader.name}</strong><span>{leader.points} pts</span></div>)}</div></section><button className="coach-note note-button" onClick={openCoach}><div className="note-icon"><Mail size={17} /></div><div><span>YOUR COACH</span><p>Sarah is ready to review your plan and answer questions.</p><small>Usually replies within a few hours</small></div><ArrowDownRight size={16} /></button></div>
      </div>
    </>
  )

  const renderThemeSwitch = () => (
    <div className="setting-row theme-row"><div><strong>Color theme</strong><span>Choose dark or light appearance.</span></div><div className="segmented"><button aria-pressed={theme === 'dark'} className={theme === 'dark' ? 'segment active' : 'segment'} onClick={() => onThemeChange('dark')}><Moon size={13} /> Dark</button><button aria-pressed={theme === 'light'} className={theme === 'light' ? 'segment active' : 'segment'} onClick={() => onThemeChange('light')}><Sun size={13} /> Light</button></div></div>
  )

  const renderSettings = () => (
    <>
      <div className="view-heading"><div><span className="eyebrow">PREFERENCES</span><h1>Settings</h1><p>Make Forma work the way you train.</p></div><button className="primary-button view-primary" onClick={() => { setClub(settings.club); onUpdateUser({ club: settings.club }); notify('Settings saved') }}><Check size={16} /> Save changes</button></div>
      <div className="settings-grid"><section className="panel settings-panel"><div className="section-heading"><div><span className="eyebrow">NOTIFICATIONS</span><h2>Stay in the loop</h2></div><Bell size={17} className="lime-text" /></div><div className="setting-row"><div><strong>Class reminders</strong><span>Get notified before a booked class.</span></div><button className={settings.notifications ? 'toggle on' : 'toggle'} aria-pressed={settings.notifications} onClick={() => setSettings({ ...settings, notifications: !settings.notifications })}><i /></button></div><div className="setting-row"><div><strong>Progress digests</strong><span>Weekly summary of your workouts.</span></div><button className={settings.reminders ? 'toggle on' : 'toggle'} aria-pressed={settings.reminders} onClick={() => setSettings({ ...settings, reminders: !settings.reminders })}><i /></button></div></section>
        <section className="panel settings-panel"><div className="section-heading"><div><span className="eyebrow">TRAINING</span><h2>Defaults</h2></div><Settings2 size={17} className="lime-text" /></div>{renderThemeSwitch()}<label className="field"><span>Home club</span><select value={settings.club} onChange={(event) => setSettings({ ...settings, club: event.target.value })}>{clubs.map((item) => <option key={item}>{item}</option>)}</select></label><label className="field"><span>Measurement units</span><select value={settings.units} onChange={(event) => setSettings({ ...settings, units: event.target.value })}><option>Metric</option><option>Imperial</option></select></label><label className="field"><span>Weekly workout goal</span><input type="number" min="1" max="14" value={weeklyGoal} onChange={(event) => setWeeklyGoal(Math.max(1, Math.min(14, Number(event.target.value) || 1)))} /></label></section>
        <section className="panel settings-panel"><div className="section-heading"><div><span className="eyebrow">ACCOUNT</span><h2>Profile access</h2></div><UserRound size={17} className="lime-text" /></div><button className="wide-button" onClick={() => setModal('password')}><Settings2 size={15} /> Change password <ArrowRight size={15} /></button><button className="wide-button danger" onClick={onSignOut}><X size={15} /> Sign out <ArrowRight size={15} /></button></section></div>
      <div className="view-heading profile-heading"><div><span className="eyebrow">MEMBER PROFILE</span><h1>{profile.name}</h1><p>Premium member since 2022 · {club}</p></div><button className="primary-button view-primary" onClick={() => { setClub(settings.club); onUpdateUser({ name: profile.name, email: profile.email, club: settings.club, bio: profile.bio }); notify('Profile updated') }}><Check size={16} /> Save profile</button></div>
        <div className="profile-layout"><section className="panel profile-card"><div className="profile-head"><div className="avatar large profile-avatar">{avatarContent}<button className="avatar-edit" aria-label="Ganti foto profil" onClick={() => avatarInputRef.current?.click()}><Camera size={13} /></button></div><input ref={avatarInputRef} type="file" accept="image/*" aria-label="Unggah foto profil" style={{ display: 'none' }} onChange={handleAvatarChange} /><div><strong>{profile.name}</strong><span>Forma Unlimited</span></div></div><div className="profile-stats"><div><strong>12</strong><span>Day streak</span></div><div><strong>{workoutCount}</strong><span>Workouts this week</span></div><div><strong>{completionPercent}%</strong><span>Goal completion</span></div></div><button className="wide-button" onClick={openCoach}><MessageCircle size={15} /> Message coach <ArrowRight size={15} /></button>{renderThemeSwitch()}</section>
        <section className="panel settings-panel"><div className="section-heading"><div><span className="eyebrow">PERSONAL DETAILS</span><h2>Edit details</h2></div></div><label className="field"><span>Full name</span><input value={profile.name} onChange={(event) => setProfile({ ...profile, name: event.target.value })} /></label><label className="field"><span>Email address</span><input type="email" value={profile.email} onChange={(event) => setProfile({ ...profile, email: event.target.value })} /></label><label className="field"><span>Training goal</span><input value={profile.goal} onChange={(event) => setProfile({ ...profile, goal: event.target.value })} /></label><button className="text-button" onClick={() => setModal('password')}>Change password <ArrowRight size={14} /></button></section></div>
    </>
  )

  const openStory = (createIfEmpty = false) => {
    if (!orderedStories.length) {
      if (createIfEmpty) storyInputRef.current?.click()
      return
    }
    setActiveStory(orderedStories.find((item) => !viewedStories.has(item.id)) ?? orderedStories[0])
  }

  const activeStoryIndex = activeStory ? orderedStories.findIndex((item) => item.id === activeStory.id) : -1

  const renderProfile = () => (
    <>
      <input ref={storyInputRef} type="file" accept="image/*" aria-label="Unggah story" style={{ display: 'none' }} onChange={handleStoryChange} />
      <section className="ig-profile-header">
        <div className="ig-avatar-column"><div className="ig-avatar-wrap" style={storyRingStyle(orderedStories, viewedStories)}><button className="avatar ig-avatar" aria-label="Lihat story" onClick={() => openStory(true)}>{avatarContent}</button><button className="ig-avatar-edit" aria-label="Buat story" onClick={() => storyInputRef.current?.click()}><Plus size={15} /></button></div><label className="ig-bio-field"><textarea aria-label="Bio profil" placeholder="Tulis bio..." rows={3} value={profile.bio} onChange={(event) => setProfile({ ...profile, bio: event.target.value })} onBlur={() => onUpdateUser({ bio: profile.bio })} /></label></div>
        <div className="ig-profile-info">
          <strong className="ig-username">{profile.name}</strong>
          <div className="ig-stats"><div><strong>{photos.length}</strong><span>posts</span></div><div><strong>1,284</strong><span>followers</span></div><div><strong>186</strong><span>following</span></div></div>
        </div>
      </section>
      <div className="ig-tabs"><button className="active"><LayoutGrid size={14} /> POSTS</button><button><Users size={14} /> TAGGED</button></div>
      <section className="panel gallery-panel ig-gallery-panel">
        {photos.length > 0 ? <div className="photo-grid ig-photo-grid">{photos.map((post) => <article className="photo-card ig-photo-card" key={post.id}><img src={postImages(post)[0]} alt={post.caption || 'Foto latihan'} role="button" tabIndex={0} onClick={() => setSelectedPhotoId(post.id)} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') setSelectedPhotoId(post.id) }} /></article>)}</div> : <div className="ig-empty"><ImagePlus size={28} /><p>Belum ada foto. Posting foto pertamamu.</p></div>}
      </section>
      {activeStory && <div className={`story-viewer${holdingStory ? ' holding' : ''}`} role="dialog" aria-modal="true" aria-label="Story"><div className="story-progress">{orderedStories.map((story, index) => <span className="story-progress-track" key={story.id}><i key={`${story.id}-${index === activeStoryIndex ? 'active' : 'idle'}`} className={index < activeStoryIndex ? 'filled' : index === activeStoryIndex ? 'current' : ''} /></span>)}</div><div className="story-header"><span className="avatar">{avatarContent}</span><div><strong>{profile.name}</strong><span>{storyTimeAgo(activeStory.createdAt)}</span></div></div><button className="story-close" aria-label="Tutup story" onClick={() => setActiveStory(null)}><X size={20} /></button><img src={activeStory.image} alt="Story" /><div className="story-touch" onPointerDown={startStoryPress} onPointerUp={endStoryPress} onPointerCancel={cancelStoryPress} onPointerLeave={cancelStoryPress} onContextMenu={(event) => event.preventDefault()} /><button className="story-delete" aria-label="Hapus story" onClick={deleteStory}><Trash2 size={18} /></button></div>}
      {visiblePhotos.length > 0 && <div className="post-viewer" role="dialog" aria-modal="true" aria-label="Detail post"><button className="post-viewer-backdrop" aria-label="Tutup post" onClick={() => setSelectedPhotoId(null)} /><div className="post-viewer-bar"><button className="post-viewer-back" aria-label="Kembali" onClick={() => setSelectedPhotoId(null)}><ArrowLeft size={20} /></button><strong>Postingan</strong></div><div className="post-viewer-card">{visiblePhotos.map((post) => <article className="post-viewer-item" key={post.id}><div className="post-viewer-top"><div className="post-viewer-avatar-wrap" style={storyRingStyle(orderedStories, viewedStories)}><button className="avatar post-viewer-avatar" aria-label="Lihat story" onClick={() => openStory()}>{avatarContent}</button></div><strong>{profile.name}</strong></div><div className="post-slider"><div className="post-slider-track" onScroll={(event) => handleSlideScroll(post.id, event)}>{postImages(post).map((image, index) => <img key={`${post.id}-${index}`} src={image} alt={post.caption || `Foto ${index + 1}`} />)}</div>{postImages(post).length > 1 && <div className="post-slider-dots">{postImages(post).map((_, index) => <i className={(activeSlides[post.id] ?? 0) === index ? 'active' : ''} key={index} />)}</div>}</div><div className="post-viewer-actions"><button className={post.liked ? 'photo-like liked' : 'photo-like'} aria-label={post.liked ? 'Batal suka' : 'Suka'} onClick={() => togglePhotoLike(post.id)}><Heart size={22} fill={post.liked ? 'currentColor' : 'none'} /> {post.likes}</button><button className="photo-share" aria-label="Bagikan foto" onClick={() => sharePhoto(post)}><Share2 size={22} /></button></div>{post.caption && <p className="post-viewer-caption">{expandedCaptions[post.id] || post.caption.length <= 50 ? post.caption : `${post.caption.slice(0, 50)}...`}{post.caption.length > 50 && <button className="caption-more" onClick={() => setExpandedCaptions((current) => ({ ...current, [post.id]: !current[post.id] }))}>{expandedCaptions[post.id] ? 'tampilkan lebih sedikit' : 'lihat selengkapnya'}</button>}</p>}</article>)}</div></div>}
    </>
  )

  const renderMessages = () => (
    <div className="messages-view">
      <div className="messages-head"><button className="messages-back" aria-label="Kembali" onClick={() => goTo('Overview')}><ArrowLeft size={20} /></button><span className="avatar messages-avatar">SM</span><div><strong>Sarah Mitchell</strong><span>Strength coach · Online</span></div></div>
      <div className="messages-thread">{chatMessages.map((item) => <div className={`chat-bubble ${item.from}`} key={item.id}><p>{item.text}</p><span>{item.time}</span></div>)}</div>
      <form className="messages-compose" onSubmit={handleChatSubmit}><input aria-label="Tulis pesan" placeholder="Tulis pesan..." value={chatInput} onChange={(event) => setChatInput(event.target.value)} /><button className="primary-button modal-submit" type="submit" aria-label="Kirim"><Send size={15} /></button></form>
    </div>
  )

  const renderSearch = () => (
    <div className="search-page">
      <div className="search-top-row"><label className="search-page-box"><Search size={18} /><input aria-label="Cari postingan" placeholder="Cari postingan atau orang..." value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} /></label><div className="search-filter-wrap"><button className="search-filter" aria-label="Filter postingan" onClick={() => setFilterOpen(!filterOpen)}><ListFilter size={18} /></button>{filterOpen && <div className="search-filter-menu">{(['ALL', 'STRENGTH', 'CARDIO', 'HIIT', 'YOGA', 'RECOVERY'] as const).map((option) => <button key={option} className={searchFilter === option ? 'active' : ''} onClick={() => { setSearchFilter(option); setFilterOpen(false) }}>{option === 'ALL' ? 'Semua' : option.charAt(0) + option.slice(1).toLowerCase()}</button>)}</div>}</div></div>
      {communityPosts.length > 0 ? <div className="search-post-grid">{communityPosts.map((post) => <article className="search-post-card" key={post.id}><img src={post.image} alt={post.caption} /></article>)}</div> : <div className="search-empty">Belum ada postingan dari orang lain.</div>}
    </div>
  )

  const views: Record<Page, () => React.JSX.Element> = {
    Overview: renderOverview,
    'My workouts': renderWorkouts,
    'Class schedule': renderSchedule,
    Progress: renderProgress,
    Community: renderCommunity,
    Settings: renderSettings,
    Profile: renderProfile,
    Messages: renderMessages,
    Search: renderSearch,
  }

  return (
    <main className={`app-shell${active === 'Settings' ? ' settings-active' : ''}`}>
      {popoverOpen && <button className="popover-scrim" aria-label="Close menus" onClick={() => { setClubOpen(false); setProfileOpen(false); setCalendarOpen(false) }} />}

      <aside className="sidebar">
        <button className="brand" onClick={() => goTo('Overview')} aria-label="Forma home"><span className="brand-mark">F</span><span>FORMA<small>ATHLETIC CLUB</small></span></button>
        <button className="club-switch" onClick={() => { setClubOpen(!clubOpen); setProfileOpen(false); setCalendarOpen(false) }}><span className="club-dot" /><div><strong>{club}</strong><small>Member since 2022</small></div><ChevronDown size={15} /></button>
        {clubOpen && <div className="popover club-popover"><span className="eyebrow">SWITCH CLUB</span>{clubs.map((item) => <button key={item} onClick={() => { setClub(item); setSettings({ ...settings, club: item }); void onUpdateUser({ club: item }); setClubOpen(false); notify(`Switched to ${item}`) }}><span className="club-dot" />{item}{club === item && <Check size={14} />}</button>)}</div>}
        <p className="nav-label">WORKSPACE</p>
        <nav className="side-nav" aria-label="Main navigation">{NAV_ITEMS.filter((item) => item.label !== 'Settings' && item.label !== 'Progress' && item.label !== 'Class schedule' && item.label !== active).map(({ label, icon: Icon }) => <button key={label} className="nav-item" onClick={() => goTo(label)}><Icon size={18} /><span>{label}</span></button>)}</nav>
        <div className="sidebar-bottom"><div className="coach-card"><div className="coach-image">SM</div><div><strong>Your coach</strong><span>Sarah Mitchell</span></div><button aria-label="Message your coach" onClick={openCoach}><ArrowRight size={15} /></button></div><button className="member-card" onClick={() => goTo('Profile')}><span className="member-tag">MEMBER PLAN</span><strong>Forma Unlimited</strong><span>Renews on Dec 12, 2026</span><div className="plan-progress"><i /></div><small>18 of 24 classes used</small></button></div>
        <button className="profile" onClick={() => { setProfileOpen(!profileOpen); setClubOpen(false) }}><div className="avatar">{avatarContent}</div><div><strong>{profile.name}</strong><small>Premium member</small></div><MoreHorizontal size={18} /></button>
        {profileOpen && <div className="popover profile-popover"><button onClick={() => goTo('Profile')}><UserRound size={15} /> My profile</button><button onClick={() => goTo('Settings')}><Settings2 size={15} /> Settings</button><button onClick={() => { setProfileOpen(false); onSignOut() }}><X size={15} /> Sign out</button></div>}
      </aside>

      <section className="main-content" id="overview">
        {active === 'Search' ? <header className="topbar search-topbar" /> : <header className="topbar"><button className="mobile-menu" aria-label="Open menu" onClick={() => setMenuOpen(!menuOpen)}>{menuOpen ? <X size={20} /> : <Menu size={20} />}</button><div className="breadcrumb"><b>{active}</b></div>{active === 'Profile' && <button className="top-post-button" aria-label="Post" onClick={() => { setPhotoPreviews([]); setPreviewIndex(0); setPhotoCaption(''); setModal('post') }}><Plus size={20} /></button>}</header>}

        {menuOpen && <div className="mobile-nav">{NAV_ITEMS.filter((item) => item.label !== 'Settings' && item.label !== 'Progress' && item.label !== 'Class schedule' && item.label !== active).map(({ label }) => <button key={label} onClick={() => goTo(label)}>{label}</button>)}{active !== 'Settings' && <button onClick={() => goTo('Settings')}>Settings</button>}</div>}
        {calendarOpen && <div className="popover calendar-popover"><div className="calendar-head"><button className="round-arrow" aria-label="Previous month" onClick={() => setCalendarOffset(calendarOffset - 1)}><ArrowLeft size={14} /></button><strong>{monthTitle(calendarOffset)}</strong><button className="round-arrow" aria-label="Next month" onClick={() => setCalendarOffset(calendarOffset + 1)}><ArrowRight size={14} /></button></div><div className="calendar-grid">{DAY_LABELS.map((day) => <span key={day}>{day.charAt(0)}</span>)}{monthGrid(calendarOffset).map(({ date, inMonth }) => { const label = DAY_LABELS[(date.getUTCDay() + 6) % 7]; return <button key={date.toISOString()} className={inMonth ? 'calendar-day' : 'calendar-day muted'} onClick={() => { setSelectedDay(label); setCalendarOpen(false); notify(`${label} selected`) }}>{date.getUTCDate()}</button> })}</div></div>}

        <div className="view-content">{views[active]()}</div>
      </section>

      <nav className={`mobile-bottom${active === 'Settings' ? ' settings-bar' : ''}`} aria-label="Mobile navigation">{MOBILE_ITEMS.map(({ label, page, icon: Icon }) => {
        const isActive = active === page
        return <button key={label} className={isActive ? 'mobile-active' : ''} aria-label={label} aria-current={isActive && page ? 'page' : undefined} onClick={() => {
          if (page === 'Search') { setSearchQuery(''); setSearchFilter('ALL') }
          if (page) goTo(page)
        }}><span className="mobile-icon"><Icon size={18} /></span></button>
      })}</nav>

      {modal && <div className="modal-layer"><button className="modal-backdrop" aria-label="Close dialog" onClick={() => setModal(null)} /><div className="modal" role="dialog" aria-modal="true"><div className="modal-head">{modal !== 'post' && <h2>{modal === 'create' ? 'Create a workout' : modal === 'goal' ? 'Weekly goal' : modal === 'password' ? 'Change password' : 'About Forma'}</h2>}<button aria-label="Close dialog" onClick={() => setModal(null)}><X size={18} /></button></div>
        {modal === 'post' && <form onSubmit={(event) => { void handlePhotoSubmit(event).then((ok) => { if (ok) setModal(null) }) }}><input ref={postInputRef} type="file" accept="image/*" multiple aria-label="Pilih gambar" style={{ display: 'none' }} onChange={handlePhotoChange} />{!photoPreviews.length && <button className="outline-button post-pick-button" type="button" aria-label="Pilih gambar" onClick={() => postInputRef.current?.click()}><Plus size={90} /></button>}{photoPreviews.length > 0 && <div className="photo-preview"><div className="photo-preview-track" onScroll={handlePreviewScroll}>{photoPreviews.map((image, index) => <img key={`${index}-${image.slice(-12)}`} src={image} alt={`Pratinjau ${index + 1}`} />)}</div><div className="photo-preview-dots">{photoPreviews.map((_, index) => <i className={index === previewIndex ? 'active' : ''} key={index} />)}</div><button type="button" aria-label="Hapus gambar" onClick={() => { setPhotoPreviews((current) => current.filter((_, index) => index !== previewIndex)); setPreviewIndex(0) }}><X size={12} /></button></div>}{photoPreviews.length > 0 && photoPreviews.length < MAX_POST_IMAGES && <button className="outline-button post-pick-button post-pick-small" type="button" aria-label="Tambah foto" onClick={() => postInputRef.current?.click()}><Plus size={24} /></button>}{photoPreviews.length > 0 && <span className="post-image-count">{photoPreviews.length}/{MAX_POST_IMAGES}</span>}{photoPreviews.length > 0 && <label className="field"><textarea aria-label="Caption foto" value={photoCaption} onChange={(event) => setPhotoCaption(event.target.value)} /></label>}{photoPreviews.length > 0 && <button className="primary-button modal-submit post-submit-icon" type="submit" aria-label="Post"><Send size={15} /></button>}</form>}
        {modal === 'create' && <form onSubmit={(event) => { event.preventDefault(); if (!newWorkout.name.trim()) return; const workout: Workout = { id: `custom-${Date.now()}`, name: newWorkout.name.trim(), type: newWorkout.type, duration: newWorkout.duration, level: newWorkout.level, focus: 'Custom plan', tag: 'CUSTOM' }; setCustomWorkouts([...customWorkouts, workout]); setNewWorkout({ name: '', type: 'STRENGTH', duration: '30 min', level: 'Beginner' }); setWorkoutFilter('ALL'); setModal(null); notify(`${workout.name} added to your plan`) }}><label className="field"><span>Workout name</span><input value={newWorkout.name} onChange={(event) => setNewWorkout({ ...newWorkout, name: event.target.value })} required /></label><label className="field"><span>Type</span><select value={newWorkout.type} onChange={(event) => setNewWorkout({ ...newWorkout, type: event.target.value as WorkoutType })}><option>STRENGTH</option><option>HIIT</option><option>RECOVERY</option></select></label><label className="field"><span>Duration</span><select value={newWorkout.duration} onChange={(event) => setNewWorkout({ ...newWorkout, duration: event.target.value })}><option>20 min</option><option>30 min</option><option>45 min</option><option>60 min</option></select></label><button className="primary-button modal-submit" type="submit"><Plus size={15} /> Add workout</button></form>}
        {modal === 'goal' && <form onSubmit={(event) => { event.preventDefault(); const value = Math.max(1, Math.min(14, Number(goalInput) || 1)); setWeeklyGoal(value); setGoalInput(String(value)); setModal(null); notify(`Weekly goal set to ${value} workouts`) }}><label className="field"><span>Workouts per week</span><input type="number" min="1" max="14" value={goalInput} onChange={(event) => setGoalInput(event.target.value)} /></label><button className="primary-button modal-submit" type="submit"><Target size={15} /> Save goal</button></form>}
        {modal === 'password' && <form onSubmit={handlePasswordSubmit}><label className="field"><span>Current password</span><input type="password" required value={passwordForm.currentPassword} onChange={(event) => setPasswordForm({ ...passwordForm, currentPassword: event.target.value })} /></label><label className="field"><span>New password</span><input type="password" required minLength={8} value={passwordForm.newPassword} onChange={(event) => setPasswordForm({ ...passwordForm, newPassword: event.target.value })} /></label><button className="primary-button modal-submit" type="submit"><Check size={15} /> Update password</button></form>}
        {modal === 'about' && <div><p className="modal-copy">Forma Athletic Club helps members build habits that last. Every workout, class, and progress update in this portal is designed around one idea: move well, live better.</p><button className="primary-button modal-submit" onClick={() => setModal(null)}>Got it <Check size={15} /></button></div>}
      </div></div>}

      {toast && <div className="toast" key={toast.id} role="status"><Check size={15} /> {toast.message}</div>}
    </main>
  )
}

function AuthScreen({ onAuthenticated }: { onAuthenticated: (user: SessionUser) => void }) {
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [form, setForm] = useState({ name: '', email: '', password: '', club: clubs[0] })
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [googleBusy, setGoogleBusy] = useState(false)

  const switchMode = (next: 'login' | 'register') => {
    setMode(next)
    setError('')
  }

  const updateField = (field: keyof typeof form, value: string) => {
    setForm((current) => ({ ...current, [field]: value }))
    if (error) setError('')
  }

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError('')
    const email = form.email.trim().toLowerCase()
    const name = form.name.trim()

    if (mode === 'register' && name.length < 2) {
      setError('Nama minimal 2 karakter.')
      return
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError('Masukkan alamat email yang valid.')
      return
    }
    if (form.password.length < 8) {
      setError('Kata sandi minimal 8 karakter.')
      return
    }

    setBusy(true)
    try {
      const url = mode === 'register' ? '/api/auth/register' : '/api/auth/login'
      const payload = mode === 'register'
        ? { name, email, password: form.password, club: form.club }
        : { name, email, password: form.password }
      const data = await apiFetch<UserResponse>(url, {
        method: 'POST',
        body: JSON.stringify(payload),
      })
      onAuthenticated(data.user)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Terjadi kesalahan. Silakan coba lagi.')
    } finally {
      setBusy(false)
    }
  }

  const handleGoogle = async () => {
    setError('')
    const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID
    if (!clientId) {
      setError('Google belum dikonfigurasi. Tambahkan NEXT_PUBLIC_GOOGLE_CLIENT_ID ke .env.local.')
      return
    }
    setGoogleBusy(true)
    try {
      await loadGoogleScript()
      if (!window.google) throw new Error('Google Sign-In tidak tersedia.')
      const tokenClient = window.google.accounts.oauth2.initTokenClient({
        client_id: clientId,
        scope: 'openid email profile',
        callback: async (response) => {
          if (response.error || !response.access_token) {
            setError('Google login dibatalkan.')
            setGoogleBusy(false)
            return
          }
          try {
            const data = await apiFetch<UserResponse>('/api/auth/google', {
              method: 'POST',
              body: JSON.stringify({ accessToken: response.access_token, club: form.club }),
            })
            onAuthenticated(data.user)
          } catch (cause) {
            setError(cause instanceof Error ? cause.message : 'Google login gagal.')
          } finally {
            setGoogleBusy(false)
          }
        },
        error_callback: () => {
          setError('Google login gagal atau dibatalkan.')
          setGoogleBusy(false)
        },
      })
      tokenClient.requestAccessToken()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Google Sign-In tidak tersedia.')
      setGoogleBusy(false)
    }
  }

  return (
    <div className="auth-page">
      <section className="auth-visual">
        <div className="auth-brand"><span className="brand-mark">F</span><span>FORMA<small>ATHLETIC CLUB</small></span></div>
        <div className="auth-copy">
          <span className="eyebrow"><span className="live-dot" /> MEMBER PORTAL</span>
          <h1>Train with<br />purpose.</h1>
          <p>Satu tempat untuk latihan, kelas, dan progresmu. Mulai hari ini, tetap konsisten besok.</p>
        </div>
        <div className="auth-features">
          <div><Check size={15} /> Rencana latihan personal</div>
          <div><Check size={15} /> Booking kelas tanpa ribet</div>
          <div><Check size={15} /> Progres yang selalu terpantau</div>
        </div>
        <div className="auth-quote">Move well. Live better.</div>
      </section>

      <section className="auth-form-side">
        <div className="auth-card">
          <span className="eyebrow">FORMA MEMBER ACCESS</span>
          <h2>{mode === 'login' ? 'Selamat datang kembali' : 'Buat akun member'}</h2>
          <p>{mode === 'login' ? 'Masuk untuk melanjutkan sesi latihanmu.' : 'Daftar sekali, lalu nikmati semua fitur klub.'}</p>

          <div className="auth-tabs" role="tablist" aria-label="Authentication mode">
            <button type="button" role="tab" aria-selected={mode === 'login'} className={mode === 'login' ? 'auth-tab active' : 'auth-tab'} onClick={() => switchMode('login')}><LogIn size={15} /> Masuk</button>
            <button type="button" role="tab" aria-selected={mode === 'register'} className={mode === 'register' ? 'auth-tab active' : 'auth-tab'} onClick={() => switchMode('register')}><UserPlus size={15} /> Daftar</button>
          </div>

          <button type="button" className="google-button" onClick={handleGoogle} disabled={googleBusy || busy}>
            <svg viewBox="0 0 48 48" aria-hidden="true"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg>
            {googleBusy ? 'Menghubungkan...' : mode === 'login' ? 'Masuk dengan Google' : 'Daftar dengan Google'}
          </button>
          <div className="auth-divider"><span>atau gunakan email</span></div>

          <form onSubmit={submit} className="auth-form">
            {mode === 'register' && <label className="auth-field"><span>Nama lengkap</span><input value={form.name} onChange={(event) => updateField('name', event.target.value)} placeholder="Alex Thompson" autoComplete="name" required /></label>}
            <label className="auth-field"><span>Email</span><input type="email" value={form.email} onChange={(event) => updateField('email', event.target.value)} placeholder="nama@email.com" autoComplete="email" required /></label>
            <label className="auth-field"><span>Kata sandi</span><div className="auth-password"><input type={showPassword ? 'text' : 'password'} value={form.password} onChange={(event) => updateField('password', event.target.value)} placeholder="Minimal 8 karakter" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} required /><button type="button" aria-label={showPassword ? 'Sembunyikan kata sandi' : 'Tampilkan kata sandi'} onClick={() => setShowPassword(!showPassword)}>{showPassword ? <EyeOff size={16} /> : <Eye size={16} />}</button></div></label>
            {mode === 'register' && <label className="auth-field"><span>Klub utama</span><select value={form.club} onChange={(event) => updateField('club', event.target.value)}>{clubs.map((item) => <option key={item}>{item}</option>)}</select></label>}
            {error && <div className="auth-error" role="alert">{error}</div>}
            <button className="primary-button auth-submit" type="submit" disabled={busy || googleBusy}>{busy ? 'Memproses...' : mode === 'login' ? 'Masuk ke portal' : 'Buat akun'} {busy ? null : <ArrowRight size={16} />}</button>
          </form>

          <p className="auth-switch">{mode === 'login' ? 'Belum punya akun?' : 'Sudah punya akun?'} <button type="button" onClick={() => switchMode(mode === 'login' ? 'register' : 'login')}>{mode === 'login' ? 'Daftar sekarang' : 'Masuk di sini'}</button></p>
          <div className="auth-note"><LockKeyhole size={14} /> Data tersimpan di server. Kata sandi di-hash dengan bcrypt, sesi memakai cookie httpOnly.</div>
        </div>
      </section>
    </div>
  )
}

export default function Page() {
  const [ready, setReady] = useState(false)
  const [user, setUser] = useState<SessionUser | null>(null)
  const [theme, setTheme] = useState<Theme>('dark')

  useEffect(() => {
    const storedTheme = localStorage.getItem(THEME_KEY)
    const nextTheme: Theme = storedTheme === 'light' ? 'light' : 'dark'
    setTheme(nextTheme)
    document.documentElement.dataset.theme = nextTheme

    const loadSession = async () => {
      try {
        const data = await apiFetch<UserResponse>('/api/auth/me')
        setUser(data.user)
      } catch {
        setUser(null)
      } finally {
        setReady(true)
      }
    }
    void loadSession()
  }, [])

  const changeTheme = useCallback((next: Theme) => {
    setTheme(next)
    document.documentElement.dataset.theme = next
    localStorage.setItem(THEME_KEY, next)
  }, [])

  const onAuthenticated = useCallback((next: SessionUser) => {
    setUser(next)
  }, [])

  const signOut = useCallback(async () => {
    try {
      await apiFetch<{ ok: boolean }>('/api/auth/logout', { method: 'POST' })
    } catch {
      return
    }
    setUser(null)
  }, [])

  const updateUser = useCallback(async (patch: Partial<SessionUser>) => {
    try {
      await apiFetch<{ user: { id: string } }>('/api/profile', {
        method: 'PATCH',
        body: JSON.stringify(patch),
      })
      const me = await apiFetch<UserResponse>('/api/auth/me')
      setUser(me.user)
    } catch {
      return
    }
  }, [])

  if (!ready) return <div className="auth-loading"><span className="brand-mark">F</span><span>Menyiapkan portal...</span></div>
  if (user) return <Dashboard user={user} theme={theme} onThemeChange={changeTheme} onSignOut={signOut} onUserChange={setUser} onUpdateUser={updateUser} />
  return <AuthScreen onAuthenticated={onAuthenticated} />
}
