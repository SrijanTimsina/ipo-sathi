import { Link, useRouter } from '@tanstack/react-router'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '#/components/ui/sidebar'
import { Avatar, AvatarFallback } from '#/components/ui/avatar'
import { Button } from '#/components/ui/button'
import { useAuth } from '../hooks/useAuth.js'
import {
  LayoutDashboard,
  Wallet,
  Briefcase,
  TrendingUp,
  CheckSquare,
  Trophy,
  Users,
  LogOut,
  Shield,
  Settings,
} from 'lucide-react'

const userNavItems = [
  { title: 'Dashboard', icon: LayoutDashboard, href: '/dashboard' },
  { title: 'Accounts', icon: Wallet, href: '/accounts' },
  { title: 'Portfolio', icon: Briefcase, href: '/portfolio' },
  { title: 'Apply', icon: TrendingUp, href: '/ipo/apply' },
  { title: 'Status', icon: CheckSquare, href: '/ipo/status' },
  { title: 'Results', icon: Trophy, href: '/ipo/results' },
]

const adminNavItems = [
  { title: 'Manage Users', icon: Users, href: '/admin/users' },
]

export function AppSidebar() {
  const { user, logout } = useAuth()
  const router = useRouter()

  const initials =
    user?.name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2) ?? '?'

  async function handleLogout(): Promise<void> {
    await logout()
    await router.navigate({ to: '/login' })
  }

  return (
    <Sidebar>
      <SidebarHeader className="border-b border-border px-6 py-4">
        <div className="flex items-center gap-3">
          <img
            src="/logo.png"
            alt="IPO Sathi Logo"
            className="h-16 w-auto object-contain"
          />
          <div>
            <p className="font-extrabold text-2xl tracking-tight bg-gradient-to-br from-green-400 to-cyan-500 bg-clip-text text-transparent">
              IPO Sathi
            </p>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {userNavItems.map((item) => {
                const pathname = router.state.location.pathname
                let isActive = false

                if (item.title === 'Apply') {
                  isActive = pathname.startsWith('/ipo/apply')
                } else {
                  isActive = pathname.startsWith(item.href)
                }

                return (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton asChild>
                      <Link
                        to={item.href}
                        className={`flex items-center gap-2 hover:bg-white/15 transition-colors p-2 ${
                          isActive
                            ? '!bg-white !text-black hover:!bg-white hover:!text-black font-medium rounded-md'
                            : ''
                        }`}
                      >
                        <item.icon className="h-4 w-4" />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {user?.role === 'admin' && (
          <SidebarGroup>
            <SidebarGroupLabel className="flex items-center gap-1">
              <Shield className="h-3 w-3" />
              Admin
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {adminNavItems.map((item) => (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton asChild>
                      <Link
                        to={item.href}
                        className="flex items-center gap-2 hover:bg-white/15 transition-colors"
                        activeProps={{
                          className:
                            '!bg-white !text-black hover:!bg-white hover:!text-black font-medium rounded-md',
                        }}
                      >
                        <item.icon className="h-4 w-4" />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>

      <SidebarFooter className="border-t border-border px-4 py-3">
        <div className="flex items-center gap-3 mb-3">
          <Avatar className="h-8 w-8">
            <AvatarFallback className="text-xs">{initials}</AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{user?.name}</p>
            <p className="text-xs text-muted-foreground capitalize">
              {user?.role}
            </p>
          </div>
        </div>

        <Link to="/settings" className="w-full">
          <Button size="sm" className="w-full" variant={'outline'}>
            <Settings className="h-4 w-4 mr-2" />
            Change Password
          </Button>
        </Link>
        <Button
          size="sm"
          className="w-full"
          onClick={() => void handleLogout()}
        >
          <LogOut className="h-4 w-4 mr-2" />
          Sign Out
        </Button>
      </SidebarFooter>
    </Sidebar>
  )
}
