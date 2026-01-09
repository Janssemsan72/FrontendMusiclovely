import { NavLink } from "react-router-dom";
import { useIsMobile } from "@/hooks/use-mobile";
import { useState, useEffect, useMemo, useCallback } from "react";
import {
  LayoutDashboard,
  ShoppingCart,
  Music,
  Clock,
  Mail,
  Image,
  FileText,
  Settings,
  CheckSquare,
  Users,
  BarChart3,
  DollarSign,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";

interface MenuItem {
  title: string;
  url: string;
  icon: any;
  permissionKey: string;
}

const adminMenuItems: MenuItem[] = [
  { title: "Dashboard", url: "/admin", icon: LayoutDashboard, permissionKey: "dashboard" },
  { title: "Métricas de Quiz", url: "/admin/quiz-metrics", icon: BarChart3, permissionKey: "dashboard" },
  { title: "Pedidos", url: "/admin/orders", icon: ShoppingCart, permissionKey: "orders" },
  { title: "Músicas", url: "/admin/songs", icon: Music, permissionKey: "songs" },
  { title: "Gerenciar Letras", url: "/admin/lyrics", icon: CheckSquare, permissionKey: "lyrics" },
  { title: "Liberações", url: "/admin/releases", icon: Clock, permissionKey: "releases" },
  { title: "Gestão Financeira", url: "/admin/financial", icon: DollarSign, permissionKey: "financial_management" },
  { title: "Colaboradores", url: "/admin/collaborators", icon: Users, permissionKey: "collaborators" },
  { title: "Emails", url: "/admin/emails", icon: Mail, permissionKey: "emails" },
  { title: "Logs de Emails", url: "/admin/email-logs", icon: Mail, permissionKey: "email_logs" },
  { title: "Mídia Home", url: "/admin/media", icon: Image, permissionKey: "media" },
  { title: "Logs", url: "/admin/logs", icon: FileText, permissionKey: "logs" },
  { title: "Configurações", url: "/admin/settings", icon: Settings, permissionKey: "settings" },
];

const defaultCollaboratorPermissions: Record<string, boolean> = {
  dashboard: true,
  orders: true,
  songs: true,
  lyrics: true,
  releases: true,
  generate: false,
  collaborators: false,
  emails: false,
  email_logs: false,
  whatsapp_templates: false,
  media: false,
  example_tracks: false,
  logs: false,
  settings: false,
};

/**
 * Determina a role do usuário priorizando collaborator sobre admin
 */
function determineUserRole(roleArray: Array<{ role: string }> | null): 'admin' | 'collaborator' | null {
  if (!roleArray || roleArray.length === 0) {
    return null;
  }

  const collaboratorRole = roleArray.find(r => String(r.role) === 'collaborator');
  const adminRole = roleArray.find(r => String(r.role) === 'admin');

  if (collaboratorRole) {
    return 'collaborator';
  }
  
  if (adminRole) {
    return 'admin';
  }

  const roleString = String(roleArray[0].role);
  return roleString === 'admin' ? 'admin' : 'collaborator';
}

/**
 * Processa permissões do colaborador a partir dos dados do banco
 */
function processCollaboratorPermissions(
  permissionsData: Array<{ permission_key: string; granted: boolean }> | null
): Record<string, boolean> {
  const permissionsMap: Record<string, boolean> = {};

  if (permissionsData && permissionsData.length > 0) {
    permissionsData.forEach(perm => {
      if (perm.granted === true) {
        permissionsMap[perm.permission_key] = true;
      }
    });
  } else {
    Object.keys(defaultCollaboratorPermissions).forEach(key => {
      if (defaultCollaboratorPermissions[key] === true) {
        permissionsMap[key] = true;
      }
    });
  }

  return permissionsMap;
}

/**
 * Verifica se um item do menu deve ser exibido baseado nas permissões
 */
function hasMenuPermission(item: MenuItem, permissions: Record<string, boolean>, isCollaborator: boolean): boolean {
  if (!isCollaborator) {
    return true;
  }

  if (!item.permissionKey) {
    return false;
  }

  return permissions[item.permissionKey] === true;
}

export function AdminSidebar() {
  const { open, openMobile, setOpenMobile } = useSidebar();
  const isMobile = useIsMobile();
  const [userRole, setUserRole] = useState<'admin' | 'collaborator' | null>(null);
  const [permissions, setPermissions] = useState<Record<string, boolean>>({});
  const [hasCachedState, setHasCachedState] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const loadUserRoleAndPermissions = useCallback(async () => {
    if (!hasCachedState) {
      setIsLoading(true);
    }

    const { supabase } = await import("@/integrations/supabase/client");
    const { data: { session } } = await supabase.auth.getSession();

    if (!session?.user) {
      setIsLoading(false);
      return;
    }
    const user = session.user;

    const [roleResult, permissionsResult] = await Promise.all([
      supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id),
      supabase
        .from("collaborator_permissions")
        .select("permission_key, granted")
        .eq("user_id", user.id)
    ]);

    const roleArray = roleResult.data;
    const roleError = roleResult.error;
    const roleValue = determineUserRole(roleArray);

    if (roleValue) {
      setUserRole(roleValue);
      if (typeof window !== 'undefined') {
        localStorage.setItem('user_role', roleValue);
      }

      if (roleValue === 'collaborator') {
        const permissionsData = permissionsResult.data;
        const permissionsMap = processCollaboratorPermissions(permissionsData);
        setPermissions(permissionsMap);
        if (typeof window !== 'undefined') {
          localStorage.setItem('user_permissions', JSON.stringify(permissionsMap));
        }
      } else {
        setPermissions({});
        if (typeof window !== 'undefined') {
          localStorage.removeItem('user_permissions');
        }
      }
    } else if (roleError) {
      console.error('Erro ao buscar role:', roleError);
    }
    
    setIsLoading(false);
  }, [hasCachedState]);

  useEffect(() => {
    const win = typeof window === "undefined" ? undefined : (window as any);
    let cancelled = false;
    let channel: any = null;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let idleId: any = null;

    let hasAnyCache = false;
    if (typeof window !== "undefined") {
      const cachedRole = localStorage.getItem("user_role") as "admin" | "collaborator" | null;
      const cachedPermissionsRaw = localStorage.getItem("user_permissions");

      if (cachedRole) {
        setUserRole(cachedRole);
      }
      if (cachedPermissionsRaw) {
        try {
          const parsed = JSON.parse(cachedPermissionsRaw);
          if (parsed && typeof parsed === "object") {
            setPermissions(parsed);
          }
        } catch {
          localStorage.removeItem("user_permissions");
        }
      }

      hasAnyCache = Boolean(cachedRole || cachedPermissionsRaw);
      if (hasAnyCache) {
        setHasCachedState(true);
        setIsLoading(false);
      }
    }

    const scheduleRefresh = () => {
      const start = () => {
        if (cancelled) return;
        loadUserRoleAndPermissions();
      };

      if (win && "requestIdleCallback" in win) {
        idleId = win.requestIdleCallback(start, { timeout: 4000 });
        return;
      }

      timer = setTimeout(start, 1200);
    };

    if (hasAnyCache) {
      scheduleRefresh();
    } else {
      loadUserRoleAndPermissions();
    }

    const setupListener = async () => {
      const { supabase } = await import("@/integrations/supabase/client");
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;

        channel = supabase
          .channel("collaborator-permissions-changes")
          .on(
            "postgres_changes",
            { event: "*", schema: "public", table: "collaborator_permissions" },
            () => {
              loadUserRoleAndPermissions();
            }
          )
          .subscribe();
      } catch {
        void 0;
      }
    };

    setupListener();

    return () => {
      cancelled = true;
      if (timer != null) {
        clearTimeout(timer);
      }
      if (idleId != null && win && typeof win.cancelIdleCallback === "function") {
        win.cancelIdleCallback(idleId);
      }
      if (channel) {
        import("@/integrations/supabase/client")
          .then(({ supabase }) => {
            supabase.removeChannel(channel);
          })
          .catch(() => {
            void 0;
          });
      }
    };
  }, [loadUserRoleAndPermissions]);

  const menuItems = useMemo(() => {
    if (isLoading) {
      return [];
    }
    
    if (!userRole) {
      return [];
    }
    
    const isCollaborator = userRole === 'collaborator';
    
    if (isCollaborator) {
      const grantedPermissions = Object.keys(permissions).filter(k => permissions[k] === true);
      if (grantedPermissions.length === 0) {
        return [];
      }
      
      return adminMenuItems.filter(item => 
        hasMenuPermission(item, permissions, isCollaborator)
      );
    }
    
    return adminMenuItems;
  }, [userRole, permissions, isLoading]);

  // Handler para fechar sidebar ao clicar em item no mobile
  const handleItemClick = () => {
    if (isMobile && openMobile) {
      setOpenMobile(false);
    }
  };

  const getSidebarItemTestId = (url: string) => {
    if (url === "/admin") return "dashboard";
    if (url.startsWith("/admin/")) return url.slice("/admin/".length);
    return url.replace(/^\//, "");
  };

  const getIconTestClass = (itemTestId: string) => {
    const map: Record<string, string> = {
      dashboard: "layoutdashboard",
      orders: "shoppingcart",
      songs: "music",
      generate: "sparkles",
      lyrics: "checksquare",
      releases: "clock",
      emails: "mail",
      media: "image",
      "example-tracks": "disc3",
      logs: "filetext",
      settings: "settings",
    };
    return map[itemTestId] ?? "";
  };

  const getNavClasses = ({ isActive }: { isActive: boolean }) =>
    isActive
      ? "active bg-[#F5EBE0] hover:bg-[#A87D5C] hover:text-white"
      : "bg-transparent hover:bg-[#A87D5C] hover:text-white transition-colors";

  return (
    <Sidebar className="border-r" collapsible="icon" variant="sidebar" side="left">
      <nav data-testid="admin-sidebar" role="navigation" className="flex h-full flex-col">
        <SidebarContent className="p-0.5 md:p-1 bg-white overflow-y-auto">
          <SidebarGroup>
            <SidebarGroupLabel className={`${!open ? "sr-only" : ""} text-[11px] md:text-[12px] font-semibold text-muted-foreground px-1.5 mb-2`} style={{ fontSize: '11px' }}>
              {userRole === 'collaborator' ? 'Colaborador' : 'Administração'}
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu className="space-y-0.5">
                {menuItems.map((item) => {
                  const itemTestId = getSidebarItemTestId(item.url);
                  const iconTestClass = getIconTestClass(itemTestId);
                  return (
                    <SidebarMenuItem key={item.title}>
                      <NavLink
                        to={item.url}
                        end={item.url === "/admin"}
                        onClick={handleItemClick}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            (e.currentTarget as HTMLElement).click();
                          }
                        }}
                        className={({ isActive }) => 
                          `${getNavClasses({ isActive })} py-1.5 md:py-2 px-2 md:px-2.5 text-[11px] md:text-[12px] rounded-lg flex items-center gap-1.5 transition-all duration-200`
                        }
                        data-testid={`sidebar-item-${itemTestId}`}
                        style={({ isActive }) => ({
                          backgroundColor: isActive ? '#F5EBE0' : 'transparent',
                          color: '#4B5563',
                          fontWeight: 400,
                          fontSize: '11px',
                        })}
                      >
                        <item.icon className={`h-3 w-3 md:h-3.5 md:w-3.5 shrink-0 ${iconTestClass}`} />
                        <span className="truncate" style={{ fontSize: '11px' }}>{item.title}</span>
                      </NavLink>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
      </nav>
    </Sidebar>
  );
}
