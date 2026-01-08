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
} from 'lucide-react';

/**
 * Re-exportar tipos se necessário
 */
export type { LucideIcon } from 'lucide-react';
