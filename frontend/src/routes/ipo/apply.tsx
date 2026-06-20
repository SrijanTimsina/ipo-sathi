import { createFileRoute, useRouter } from '@tanstack/react-router'
import { useState, useEffect } from 'react'
import { z } from 'zod'
import { toast } from 'sonner'
import { ProtectedRoute } from '#/shared/components/ProtectedRoute'
import { AppLayout } from '#/shared/components/AppLayout'
import {
  useAvailableIpos,
  useBulkApply,
  useIpoStatus,
} from '#/app/ipo/api/ipo.queries'
import { useAccounts } from '#/app/accounts/api/accounts.queries'
import type { IpoApplication } from '#/shared/types/api'
import { TableSkeleton } from '#/shared/components/LoadingSkeleton'
import { ErrorMessage, EmptyState } from '#/shared/components/ErrorMessage'
import { Button } from '#/components/ui/button'
import { Input } from '#/components/ui/input'
import { Label } from '#/components/ui/label'
import { Card, CardContent } from '#/components/ui/card'
import { Badge } from '#/components/ui/badge'
import { Checkbox } from '#/components/ui/checkbox'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '#/components/ui/select'
import { TrendingUp, ArrowLeft, Loader2 } from 'lucide-react'

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

const applySearchSchema = z.object({
  companyShareId: z.coerce.number().optional(),
  ipoName: z.string().optional(),
})

export const Route = createFileRoute('/ipo/apply')({
  validateSearch: applySearchSchema,
  component: ApplyPage,
})

function ApplyPage() {
  return (
    <ProtectedRoute>
      <AppLayout>
        <ApplyContent />
      </AppLayout>
    </ProtectedRoute>
  )
}

function ApplyContent() {
  const search = Route.useSearch()
  const router = useRouter()
  const {
    data: ipos,
    isLoading: iposLoading,
    isError: iposError,
  } = useAvailableIpos()
  const { data: accounts, isLoading: accountsLoading } = useAccounts(1, 100)
  const bulkApply = useBulkApply()

  const [selectedIpoId, setSelectedIpoId] = useState<string>(
    search.companyShareId ? String(search.companyShareId) : '',
  )
  const [selectedIpoName, setSelectedIpoName] = useState<string>(
    search.ipoName ?? '',
  )
  const [kittas, setKittas] = useState<string>('10')
  const [selectedAccountIds, setSelectedAccountIds] = useState<string[]>([])
  const [applyAll, setApplyAll] = useState(true)
  const [applyResults, setApplyResults] = useState<IpoApplication[]>([])

  const selectedIpo = ipos?.find(
    (i) => String(i.companyShareId) === selectedIpoId,
  )

  const {
    data: statusData,
    isFetching: statusFetching,
    refetch: refetchStatus,
  } = useIpoStatus(selectedIpoId || undefined)

  useEffect(() => {
    if (ipos && ipos.length === 1 && !selectedIpoId) {
      setSelectedIpoId(String(ipos[0].companyShareId))
      setSelectedIpoName(ipos[0].companyName)
    }
  }, [ipos, selectedIpoId])
  function toggleAccount(id: string): void {
    setSelectedAccountIds((prev) =>
      prev.includes(id) ? prev.filter((a) => a !== id) : [...prev, id],
    )
  }

  async function handleApply(): Promise<void> {
    if (!selectedIpoId || !selectedIpoName) {
      toast.error('Please select an IPO first')
      return
    }
    const kittaNum = parseInt(kittas, 10)
    if (isNaN(kittaNum) || kittaNum < 1) {
      toast.error('Enter a valid number of kittas')
      return
    }

    try {
      const res = await bulkApply.mutateAsync({
        companyShareId: parseInt(selectedIpoId, 10),
        ipoName: selectedIpoName,
        kittas: kittaNum,
        accountIds: applyAll ? undefined : selectedAccountIds,
      })
      setApplyResults(res.applications)
      await refetchStatus()
    } catch {
      toast.error('Bulk application failed. Check your network and try again.')
    }
  }

  if (iposLoading || accountsLoading) return <TableSkeleton />
  if (iposError)
    return (
      <ErrorMessage message="Could not load IPOs. Make sure you have an active MeroShare account." />
    )

  if (!ipos || ipos.length === 0) {
    return (
      <EmptyState
        icon={<TrendingUp className="h-12 w-12" />}
        title="No open IPOs"
        description="There are no IPOs currently available for application."
      />
    )
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => router.history.back()}
          className="rounded-full"
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-2xl font-bold">Bulk IPO Application</h1>
      </div>

      <Card className="border-muted-foreground/20 shadow-sm rounded-3xl overflow-hidden">
        <CardContent className="p-6 sm:p-8 space-y-8">
          {/* Selected IPO */}
          <div className="space-y-2">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">
              Selected IPO
            </Label>
            <Select
              value={selectedIpoId}
              onValueChange={(val) => {
                setSelectedIpoId(val)
                const ipo = ipos.find((i) => String(i.companyShareId) === val)
                setSelectedIpoName(ipo?.companyName ?? '')
              }}
            >
              <SelectTrigger
                id="ipo-select"
                className="w-full rounded-full h-14! px-4! text-lg bg-background border border-muted-foreground/20 shadow-sm [&>span]:w-full"
              >
                <SelectValue placeholder="Select an IPO…">
                  {selectedIpoId ? (
                    <div className="flex w-full justify-between items-center pr-2">
                      <span>
                        {
                          ipos.find(
                            (i) => String(i.companyShareId) === selectedIpoId,
                          )?.companyName
                        }{' '}
                        —{' '}
                        {
                          ipos.find(
                            (i) => String(i.companyShareId) === selectedIpoId,
                          )?.shareTypeName
                        }
                      </span>
                      <span className="text-sm text-muted-foreground ml-auto">
                        {formatDateToMonthDay(
                          ipos.find(
                            (i) => String(i.companyShareId) === selectedIpoId,
                          )?.issueOpenDate,
                        )}{' '}
                        -{' '}
                        {formatDateToMonthDay(
                          ipos.find(
                            (i) => String(i.companyShareId) === selectedIpoId,
                          )?.issueCloseDate,
                        )}
                      </span>
                    </div>
                  ) : (
                    'Select an IPO…'
                  )}
                </SelectValue>
              </SelectTrigger>
              <SelectContent className="rounded-2xl">
                {ipos.map((ipo) => (
                  <SelectItem
                    key={ipo.companyShareId}
                    value={String(ipo.companyShareId)}
                    className="rounded-xl w-full"
                  >
                    <div className="flex w-full justify-between items-center pr-2">
                      <span>
                        {ipo.companyName} — {ipo.shareTypeName}
                      </span>
                      <span className="text-xs text-muted-foreground ml-auto pl-4">
                        {formatDateToMonthDay(ipo.issueOpenDate)} -{' '}
                        {formatDateToMonthDay(ipo.issueCloseDate)}
                      </span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Quantity */}
          <div className="space-y-2">
            <Label
              htmlFor="kittas"
              className="text-xs uppercase tracking-wider text-muted-foreground"
            >
              Quantity
            </Label>
            <Input
              id="kittas"
              type="number"
              min={selectedIpo?.minUnit ?? 10}
              max={selectedIpo?.maxUnit}
              value={kittas}
              onChange={(e) => setKittas(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
                  e.preventDefault()
                }
              }}
              className="w-full rounded-full h-14! px-4! text-lg bg-background border border-muted-foreground/20 shadow-sm [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            />
          </div>

          {/* Actions */}
          <div className="pt-2 flex justify-center border-b pb-8 border-muted/50">
            <Button
              id="apply-submit-btn"
              className="w-full px-16 rounded-full py-6! text-lg font-semibold cursor-pointer"
              onClick={() => void handleApply()}
              disabled={bulkApply.isPending || !selectedIpoId}
            >
              {bulkApply.isPending ? (
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              ) : (
                'Apply'
              )}
            </Button>
          </div>

          {/* Accounts */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">
                Apply From Accounts
              </Label>
              {statusFetching && (
                <span className="text-xs text-muted-foreground animate-pulse">
                  Checking status...
                </span>
              )}
            </div>
            <div className="rounded-2xl border bg-background overflow-hidden shadow-sm">
              <div
                className={`p-4 flex items-center gap-3 cursor-pointer transition-colors ${
                  applyAll ? 'bg-primary/5' : 'hover:bg-muted/50'
                }`}
                onClick={() => setApplyAll(!applyAll)}
              >
                <Checkbox
                  id="apply-all"
                  checked={applyAll}
                  onCheckedChange={(v) => setApplyAll(Boolean(v))}
                />
                <Label
                  htmlFor="apply-all"
                  className="cursor-pointer font-medium flex-1"
                >
                  Select All (
                  {accounts?.data.filter((a) => a.isActive).length ?? 0})
                </Label>
              </div>

              <div className="border-t divide-y">
                {accounts?.data
                  .filter((a) => a.isActive)
                  .map((account) => {
                    let accStatus = statusData?.find(
                      (s) => s.brokerAccountId === account.id,
                    )
                    const applyResult = applyResults.find(
                      (a) => a.brokerAccountId === account.id,
                    )

                    // If we just attempted to apply and it errored, that takes precedence over whatever MeroShare reports (which might just say 'not_applied' because it failed to apply)
                    if (applyResult && applyResult.status === 'error' && applyResult.errorMessage) {
                      accStatus = {
                        ...(accStatus || {}),
                        status: applyResult.status,
                        errorMessage: applyResult.errorMessage,
                        ipoName: applyResult.ipoName || accStatus?.ipoName || 'Unknown IPO',
                      } as IpoApplication
                    }

                    const isApplied =
                      accStatus &&
                      (accStatus.status === 'applied' ||
                        accStatus.status === 'pending' ||
                        accStatus.status === 'allotted')

                    let badgeLabel = ''
                    let badgeClasses = ''
                    if (accStatus) {
                      if (
                        accStatus.status === 'error' &&
                        accStatus.ipoName === 'Unknown IPO / Fetch Error'
                      ) {
                        badgeLabel = 'Connection Error'
                        badgeClasses =
                          'bg-orange-500/10 text-orange-600 border-orange-500/20'
                      } else {
                        switch (accStatus.status) {
                          case 'applied':
                            badgeLabel = 'Verified'
                            badgeClasses =
                              'bg-green-500/10 text-green-600 border-green-500/20'
                            break
                          case 'pending':
                            badgeLabel = 'Unverified'
                            badgeClasses =
                              'bg-blue-500/10 text-blue-600 border-blue-500/20'
                            break
                          case 'allotted':
                            badgeLabel = 'Allotted'
                            badgeClasses =
                              'bg-emerald-500/10 text-emerald-600 border-emerald-500/20'
                            break
                          case 'not_allotted':
                            badgeLabel = 'Not Allotted'
                            badgeClasses =
                              'bg-gray-500/10 text-gray-600 border-gray-500/20'
                            break
                          case 'error':
                            badgeLabel = 'Rejected'
                            badgeClasses =
                              'bg-red-500/10 text-red-600 border-red-500/20'
                            break
                          default:
                            badgeLabel = accStatus.status
                            badgeClasses = 'bg-muted/50 text-muted-foreground'
                        }
                      }
                    }

                    return (
                      <div
                        key={account.id}
                        className={`p-4 flex items-center gap-3 transition-colors hover:bg-muted/50 cursor-pointer ${
                          isApplied ? 'bg-muted/20 opacity-75' : ''
                        }`}
                        onClick={() => toggleAccount(account.id)}
                      >
                        <Checkbox
                          id={`account-${account.id}`}
                          checked={
                            applyAll || selectedAccountIds.includes(account.id)
                          }
                          disabled={applyAll}
                          onCheckedChange={() => toggleAccount(account.id)}
                        />
                        <div className="flex-1 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                          <div className="flex flex-col gap-1">
                            <Label
                              htmlFor={`account-${account.id}`}
                              className="cursor-pointer font-medium"
                            >
                              {account.name || account.username}
                            </Label>
                            {accStatus &&
                              (accStatus.errorMessage ||
                                accStatus.meroShareRemark) && (
                                <span
                                  className={`text-xs ${accStatus.status === 'error' ? 'text-red-500' : 'text-muted-foreground'}`}
                                >
                                  {accStatus.errorMessage ||
                                    accStatus.meroShareRemark}
                                </span>
                              )}
                          </div>

                          {accStatus && (
                            <Badge
                              variant="outline"
                              className={`text-[10px] uppercase tracking-wider ${badgeClasses}`}
                            >
                              {badgeLabel}
                            </Badge>
                          )}
                        </div>
                      </div>
                    )
                  })}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
