/**
 * Sistema de importação seletiva de ícones do lucide-react
 * 
 * Este arquivo centraliza as importações de ícones para permitir
 * tree-shaking eficiente e reduzir o bundle size.
 * 
 * Importe os ícones deste arquivo em vez de diretamente de 'lucide-react'
 * 
 * Exemplo:
 *   import { Star, Music } from '@/utils/iconImports';
 */

// Ícones mais usados - importação direta para tree-shaking
export {
  // Navegação e ações
  ArrowLeft,
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  
  // Status e feedback
  Check,
  CheckCircle,
  CheckCircle2,
  X,
  XCircle,
  AlertCircle,
  AlertTriangle,
  Loader2,
  Home,
  Share2,
  
  // Mídia
  Music,
  Play,
  Pause,
  Download,
  
  // UI e interação
  Star,
  Heart,
  Mail,
  Search,
  Filter,
  Eye,
  EyeOff,
  Copy,
  Edit,
  Trash2,
  RefreshCw,
  Calendar,
  CalendarIcon,
  Clock,
  
  // Comunicação
  MessageCircle,
  MessageSquare,
  Phone,
  Quote,
  // Nota: MessageSquare já está acima
  
  // Negócio e dados
  CreditCard,
  ShoppingCart,
  Wallet,
  TrendingUp,
  BarChart3,
  Activity,
  Users,
  Globe,
  MapPin,
  DollarSign,
  TestTube,
  Save,
  Settings,
  Plus,
  Music2,
  WifiOff,
  RotateCcw,
  User,
  LogOut,
  Inbox,
  Archive,
  Reply,
  Upload,
  FileCheck,
  Cookie,
  UserCheck,
  Database,
  MousePointerClick,
  
  // Segurança e confiança
  Shield,
  Lock,
  
  // Outros
  Gift,
  Zap,
  Rocket,
  ExternalLink,
  Send,
  Sparkles,
  Menu,
  
  // Adicionais para otimização (sem duplicatas)
  Award,
  HelpCircle,
  
  // Documentos e arquivos
  FileText,
  Image,
  
  // UI e layout
  PanelLeft,
  LayoutDashboard,
  CheckSquare,
  
  // Adicionais identificados
  TrendingDown,
  FileQuestion,
  UserPlus,
  Flag,
  
  // Componentes UI
  GripVertical,
  Circle,
  MoreHorizontal,
  Dot,
  
  // Player de música
  SkipBack,
  SkipForward,
  Volume2,
  
  // Clima
  Cloud,
  CloudRain,
  Sun,
  CloudSun,
  Droplets,
  Wind,
  Wifi,
  
  // Edição
  Pencil,
  Mic,
  AlarmClock,
  
  // Dispositivos
  Smartphone,
  Monitor,
  
  // Analytics
  Scroll,
  Bug,
} from 'lucide-react';

/**
 * Re-exportar tipos se necessário
 */
export type { LucideIcon } from 'lucide-react';
