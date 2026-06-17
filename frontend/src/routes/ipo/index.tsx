import { createFileRoute, Link, useRouter } from '@tanstack/react-router'
import { ProtectedRoute } from '#/shared/components/ProtectedRoute'
import { AppLayout } from '#/shared/components/AppLayout'
import { useAvailableIpos } from '#/app/ipo/api/ipo.queries'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '#/components/ui/card'
import { Badge } from '#/components/ui/badge'
import { Button } from '#/components/ui/button'
import { Skeleton } from '#/components/ui/skeleton'
import { Calendar, Briefcase, ChevronRight, ArrowLeft } from 'lucide-react'

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

export const Route = createFileRoute('/ipo/')({
  component: IpoListPage,
})

function IpoListPage() {
  return (
    <ProtectedRoute>
      <AppLayout>
        <IpoListContent />
      </AppLayout>
    </ProtectedRoute>
  )
}

function IpoListContent() {
  const router = useRouter()
  const ipos = useAvailableIpos()

  return (
    <div className="space-y-6  ">
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => router.history.back()}
          className="rounded-full"
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold">Open IPOs</h1>
        </div>
      </div>

      {ipos.isLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
      ) : ipos.data && ipos.data.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {ipos.data.map((ipo) => (
            <Card key={ipo.companyShareId} className="flex flex-col">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="text-base leading-tight">
                    {ipo.companyName}
                  </CardTitle>
                  <Badge
                    variant="outline"
                    className={`whitespace-nowrap ${getShareTypeColor(ipo.shareTypeName)}`}
                  >
                    {ipo.shareTypeName}
                  </Badge>
                </div>
                <CardDescription className="text-xs font-mono mt-1">
                  {ipo.scrip}
                </CardDescription>
              </CardHeader>
              <CardContent className="flex-1 flex flex-col justify-between">
                <div className="space-y-2 mb-6">
                  <div className="flex items-center text-sm text-muted-foreground">
                    <Calendar className="mr-2 h-4 w-4" />
                    <span>
                      {formatDateToMonthDay(ipo.issueOpenDate)} -{' '}
                      {formatDateToMonthDay(ipo.issueCloseDate)}
                    </span>
                  </div>
                  <div className="flex items-center text-sm text-muted-foreground">
                    <Briefcase className="mr-2 h-4 w-4" />
                    <span>{ipo.subGroup || 'General Public'}</span>
                  </div>
                </div>
                <Button asChild className="w-full group">
                  <Link
                    to="/ipo/apply"
                    search={{
                      companyShareId: ipo.companyShareId,
                      ipoName: ipo.companyName,
                    }}
                  >
                    Apply Now
                    <ChevronRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
                  </Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="p-12 text-center border-dashed">
          <div className="mx-auto bg-muted/50 rounded-full w-16 h-16 flex items-center justify-center mb-4">
            <Briefcase className="h-8 w-8 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-medium mb-2">No Open IPOs</h3>
          <p className="text-muted-foreground max-w-sm mx-auto">
            There are currently no active IPOs available for application. Check
            back later.
          </p>
        </Card>
      )}
    </div>
  )
}
