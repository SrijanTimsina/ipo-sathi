import { SidebarProvider, SidebarTrigger } from '#/components/ui/sidebar'
import { AppSidebar, userNavItems } from './AppSidebar.js'
import { useAuth } from '../hooks/useAuth.js'
import { Link, useRouter } from '@tanstack/react-router'
import { Button } from '#/components/ui/button'
import { Avatar, AvatarFallback } from '#/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '#/components/ui/dropdown-menu'
import { KeyRound, LogOut, User, Users } from 'lucide-react'
import type { ReactNode } from 'react'

interface AppLayoutProps {
  children: ReactNode
}

export function AppLayout({ children }: AppLayoutProps) {
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
    <SidebarProvider>
      <div className="flex min-h-screen w-full">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <header className="sticky top-0 z-10 flex h-14 items-center justify-between border-b border-border bg-background/80 backdrop-blur-sm px-4">
            <SidebarTrigger className="hidden md:flex" />
            <div className="md:hidden flex items-center gap-2">
              <img src="/logo.png" alt="Logo" className="h-8 w-auto object-contain" />
              <p className="font-extrabold text-lg tracking-tight bg-gradient-to-br from-green-400 to-cyan-500 bg-clip-text text-transparent">
                IPO Sathi
              </p>
            </div>
            <div className="flex items-center gap-4 ml-auto">
              <div className="text-sm text-muted-foreground hidden sm:block">
                Built by{' '}
                <a
                  href="https://srijantimsina.com.np"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-primary transition-colors hover:underline"
                >
                  Srijan Timsina
                </a>
              </div>
              {!user && (
                <Link to="/login">
                  <Button size="icon" variant="default" className="h-8 w-8 rounded-full" title="Sign In">
                    <User className="h-4 w-4" />
                    <span className="sr-only">Sign in</span>
                  </Button>
                </Link>
              )}
              {user && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      className="relative h-8 w-8 rounded-full border border-border/50 overflow-hidden p-0 hover:bg-primary/20"
                    >
                      <Avatar className="h-full w-full">
                        <AvatarFallback className="text-xs bg-white text-black font-medium">
                          {initials}
                        </AvatarFallback>
                      </Avatar>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="w-56" align="end" forceMount>
                    <div className="flex items-center gap-3 p-2">
                      <Avatar className="h-8 w-8 border border-border/50">
                        <AvatarFallback className="text-xs bg-primary/10 text-primary font-medium">
                          {initials}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex flex-col space-y-0.5">
                        <p className="text-sm font-medium leading-none">
                          {user.name}
                        </p>
                        <p className="text-xs leading-none text-muted-foreground capitalize">
                          {user.role}
                        </p>
                      </div>
                    </div>
                    <DropdownMenuSeparator />
                    {user.role === 'admin' && (
                      <DropdownMenuItem asChild>
                        <Link
                          to="/admin/users"
                          className="w-full cursor-pointer flex items-center"
                        >
                          <Users className="mr-2 h-4 w-4" />
                          <span>Manage Users</span>
                        </Link>
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuItem asChild>
                      <Link
                        to="/settings"
                        className="w-full cursor-pointer flex items-center"
                      >
                        <KeyRound className="mr-2 h-4 w-4" />
                        <span>Change Password</span>
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => void handleLogout()}
                      className="cursor-pointer text-red-600 focus:text-red-600 focus:bg-red-100 dark:focus:bg-red-950/50"
                    >
                      <LogOut className="mr-2 h-4 w-4" />
                      <span>Sign Out</span>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
          </header>
          <main className="flex-1 p-6 pb-24 md:pb-6">{children}</main>
          
          {/* Mobile Bottom Navigation */}
          <div className="md:hidden fixed bottom-0 left-0 right-0 border-t border-border bg-background z-50 px-2 pb-safe pb-4">
            <div className="flex justify-around items-center h-16">
              {userNavItems.map((item) => {
                const pathname = router.state.location.pathname
                const isActive = item.title === 'Apply' 
                  ? pathname.startsWith('/ipo/apply')
                  : pathname.startsWith(item.href)

                return (
                  <Link
                    key={item.href}
                    to={item.href}
                    className={`flex flex-col items-center justify-center w-full h-full space-y-1 ${
                      isActive ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    <div
                      className={`p-1 rounded-md transition-colors ${
                        isActive ? 'bg-primary/20 text-primary' : ''
                      }`}
                    >
                      <item.icon className="h-5 w-5" />
                    </div>
                    <span className="text-[10px] font-medium leading-none">
                      {item.title}
                    </span>
                  </Link>
                )
              })}
            </div>
          </div>
        </div>
      </div>
    </SidebarProvider>
  )
}
