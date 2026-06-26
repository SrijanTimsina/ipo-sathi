import { createFileRoute, Link } from '@tanstack/react-router'
import { ProtectedRoute } from '#/shared/components/ProtectedRoute'
import { AppLayout } from '#/shared/components/AppLayout'
import { useAuth } from '#/shared/hooks/useAuth'
import { useAccounts } from '#/app/accounts/api/accounts.queries'
import { useAvailableIpos } from '#/app/ipo/api/ipo.queries'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '#/components/ui/card'
import { Badge } from '#/components/ui/badge'
import { Button } from '#/components/ui/button'
import { Skeleton } from '#/components/ui/skeleton'
import { Wallet, TrendingUp, ArrowRight, Calendar, Info } from 'lucide-react'

const getShareTypeColor = (type: string) => {
  switch (type.toUpperCase()) {
    case 'IPO':
      return 'bg-green-500/10 text-green-400 border-green-500/30'
    case 'FPO':
      return 'bg-orange-500/10 text-orange-400 border-orange-500/30'
    default:
      return 'bg-purple-500/10 text-purple-400 border-purple-500/30'
  }
}

function formatDateToMonthDay(dateString?: string) {
  if (!dateString) return 'N/A'
  try {
    const d = new Date(dateString)
    if (isNaN(d.getTime())) {
      const parts = dateString.split(' ')
      return parts.length >= 2
        ? `${parts[0]} ${parts[1]?.replace(',', '')}`
        : dateString
    }
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  } catch {
    return dateString
  }
}

export const Route = createFileRoute('/dashboard')({
  component: DashboardPage,
})

function DashboardPage() {
  return (
    <ProtectedRoute>
      <AppLayout>
        <DashboardContent />
      </AppLayout>
    </ProtectedRoute>
  )
}

function DashboardContent() {
  const { user } = useAuth()
  const accounts = useAccounts(1, 100)
  const ipos = useAvailableIpos()

  const activeAccounts =
    accounts.data?.data.filter((a) => a.isActive).length ?? 0
  const openIpos = ipos.data?.length ?? 0

  return (
    <div className="space-y-6">
      {!user && (
        <Card className="bg-muted/30 border-primary/20">
          <CardHeader className="pb-3">
            <CardTitle className="text-base text-primary flex items-center gap-2">
              <Info className="h-5 w-5" />
              Browser Mode Active
            </CardTitle>
            <CardDescription>
              Without logging in, automated features like auto-apply, auto result check, and WhatsApp messages are unavailable.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm mb-4 text-muted-foreground">
              If you have an account, sign in to enable full automation and cloud sync.
            </p>
            <Button asChild variant="default" size="sm">
              <Link to="/login">
                Log in to Sync
              </Link>
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <StatCard
          title="Active Accounts"
          value={accounts.isLoading ? null : activeAccounts}
          icon={<Wallet className="h-5 w-5" />}
          href="/accounts"
          color="blue"
        />
        <StatCard
          title="Open IPOs"
          value={ipos.isLoading ? null : openIpos}
          icon={<TrendingUp className="h-5 w-5" />}
          href="/ipo"
          color="green"
        />
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Quick Apply</CardTitle>
            <CardDescription>
              Apply for open IPOs across all your accounts
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild className="w-full">
              <Link to="/ipo/apply">
                Start Bulk Application <ArrowRight className="h-4 w-4 ml-2" />
              </Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Manage Accounts</CardTitle>
            <CardDescription>
              Add or update your MeroShare accounts
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" asChild className="w-full">
              <Link to="/accounts">
                View Accounts <ArrowRight className="h-4 w-4 ml-2" />
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Open IPOs preview */}
      {ipos.isLoading ? (
        <Skeleton className="h-40 w-full" />
      ) : openIpos > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Currently Open IPOs</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {ipos.data?.map((ipo) => (
              <Link
                key={ipo.companyShareId}
                to="/ipo/apply"
                search={{
                  companyShareId: ipo.companyShareId,
                  ipoName: ipo.companyName,
                }}
                className="flex items-center justify-between p-4 rounded-xl border hover:border-primary/50 hover:bg-muted/50 transition-colors"
              >
                <div>
                  <p className="font-medium">{ipo.companyName}</p>
                  <p className="text-xs text-muted-foreground mt-1.5 flex items-center gap-1.5">
                    <Calendar className="h-3.5 w-3.5" />
                    {formatDateToMonthDay(ipo.issueOpenDate)} -{' '}
                    {formatDateToMonthDay(ipo.issueCloseDate)}
                  </p>
                </div>
                <Badge
                  variant="outline"
                  className={getShareTypeColor(ipo.shareTypeName)}
                >
                  {ipo.shareTypeName}
                </Badge>
              </Link>
            ))}
          </CardContent>
        </Card>
      ) : null}
    </div>
  )
}

interface StatCardProps {
  title: string
  value: number | null
  icon: React.ReactNode
  href: string
  color: 'blue' | 'green' | 'yellow' | 'purple'
}

function StatCard({ title, value, icon, href, color }: StatCardProps) {
  const colorClass = {
    blue: 'text-blue-600 bg-blue-50',
    green: 'text-green-600 bg-green-50',
    yellow: 'text-yellow-600 bg-yellow-50',
    purple: 'text-purple-600 bg-purple-50',
  }[color]

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="pt-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">{title}</p>
            {value === null ? (
              <Skeleton className="h-8 w-12 mt-1" />
            ) : (
              <p className="text-3xl font-bold mt-1">{value}</p>
            )}
          </div>
          <div className={`p-3 rounded-full ${colorClass}`}>{icon}</div>
        </div>
        <Link
          to={href}
          className="text-xs text-muted-foreground hover:text-foreground mt-3 flex items-center gap-1 transition-colors"
        >
          View details <ArrowRight className="h-3 w-3" />
        </Link>
      </CardContent>
    </Card>
  )
}
