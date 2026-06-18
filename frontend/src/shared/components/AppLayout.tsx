import { SidebarProvider, SidebarTrigger } from '#/components/ui/sidebar'
import { AppSidebar } from './AppSidebar.js'
import type { ReactNode } from 'react'

interface AppLayoutProps {
  children: ReactNode
}

export function AppLayout({ children }: AppLayoutProps) {
  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <header className="sticky top-0 z-10 flex h-14 items-center justify-between border-b border-border bg-background/80 backdrop-blur-sm px-4">
            <SidebarTrigger />
            <div className="text-sm text-muted-foreground">
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
          </header>
          <main className="flex-1 p-6">{children}</main>
        </div>
      </div>
    </SidebarProvider>
  )
}
