import { useState, useMemo, useEffect } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { ProtectedRoute } from '#/shared/components/ProtectedRoute'
import { AppLayout } from '#/shared/components/AppLayout'
import {
  useAppliedIpos,
  useIpoStatus,
  useAvailableIpos,
  useReapply,
} from '#/app/ipo/api/ipo.queries'
import { ErrorMessage, EmptyState } from '#/shared/components/ErrorMessage'
import { Badge } from '#/components/ui/badge'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '#/components/ui/command'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '#/components/ui/popover'
import { Button } from '#/components/ui/button'
import {
  CheckSquare,
  ShieldCheck,
  ShieldAlert,
  XCircle,
  Clock,
  ChevronLeft,
  Info,
  Landmark,
  ChevronsUpDown,
  Check,
  Loader2,
  RefreshCw,
} from 'lucide-react'
import type { IpoStatus } from '#/shared/types/api'
import { cn } from '#/lib/utils'

export const Route = createFileRoute('/ipo/status')({
  component: IpoStatusPage,
})

function IpoStatusPage() {
  return (
    <ProtectedRoute>
      <AppLayout>
        <IpoStatusContent />
      </AppLayout>
    </ProtectedRoute>
  )
}

// Map backend status to mockup UI status
const statusUiMap: Record<
  IpoStatus,
  {
    label: string
    color: string
    icon: React.ReactNode
    borderClass: string
    textClass: string
    bgClass: string
  }
> = {
  applied: {
    label: 'Verified',
    color: 'text-green-500',
    bgClass: 'bg-green-500/10',
    borderClass: 'border-green-500/30',
    textClass: 'text-green-500',
    icon: <ShieldCheck className="h-8 w-8 text-green-500" />,
  },
  pending: {
    label: 'Unverified',
    color: 'text-blue-400',
    bgClass: 'bg-blue-400/10',
    borderClass: 'border-blue-400/30',
    textClass: 'text-blue-400',
    icon: <Clock className="h-8 w-8 text-blue-400" />,
  },
  allotted: {
    label: 'Allotted',
    color: 'text-emerald-500',
    bgClass: 'bg-emerald-500/10',
    borderClass: 'border-emerald-500/30',
    textClass: 'text-emerald-500',
    icon: <ShieldCheck className="h-8 w-8 text-emerald-500" />,
  },
  not_allotted: {
    label: 'Not Allotted',
    color: 'text-gray-400',
    bgClass: 'bg-gray-400/10',
    borderClass: 'border-gray-400/30',
    textClass: 'text-gray-400',
    icon: <ShieldAlert className="h-8 w-8 text-gray-400" />,
  },
  error: {
    label: 'Rejected',
    color: 'text-red-500',
    bgClass: 'bg-red-500/10',
    borderClass: 'border-red-500/30',
    textClass: 'text-red-500',
    icon: <XCircle className="h-8 w-8 text-red-500" />,
  },
  not_applied: {
    label: 'Not Applied',
    color: 'text-orange-500',
    bgClass: 'bg-orange-500/10',
    borderClass: 'border-orange-500/30',
    textClass: 'text-orange-500',
    icon: <Info className="h-8 w-8 text-orange-500" />,
  },
}

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

function IpoStatusContent() {
  const [selectedIpoId, setSelectedIpoId] = useState<string>('')
  const [openCombobox, setOpenCombobox] = useState(false)
  const [activeFilter, setActiveFilter] = useState<string | null>(null)

  const {
    data: appliedIpos,
    isError: isErrorIpos,
    refetch: refetchIpos,
  } = useAppliedIpos()

  const {
    data: statusData,
    isLoading: isLoadingStatus,
    isError: isErrorStatus,
    isRefetching: isRefetchingStatus,
    refetch: refetchStatus,
  } = useIpoStatus(selectedIpoId || undefined, undefined, {
    enabled: !!selectedIpoId,
  })

  const { data: availableIpos } = useAvailableIpos()
  const isIpoOpen = useMemo(() => {
    if (!availableIpos || !selectedIpoId) return false
    return availableIpos.some(
      (ipo) => String(ipo.companyShareId) === selectedIpoId,
    )
  }, [availableIpos, selectedIpoId])

  const reapplyMutation = useReapply()

  // Auto-select first IPO if available and nothing is selected
  useEffect(() => {
    if (appliedIpos && appliedIpos.length > 0 && !selectedIpoId) {
      setSelectedIpoId(String(appliedIpos[0].companyShareId))
    }
  }, [appliedIpos, selectedIpoId])

  // Calculate filters
  const filterCounts = useMemo(() => {
    if (!statusData) return {}
    const counts: Record<string, number> = {}
    statusData.forEach((app) => {
      let label = statusUiMap[app.status].label
      if (
        app.status === 'error' &&
        app.ipoName === 'Unknown IPO / Fetch Error'
      ) {
        label = 'Connection Error'
      }
      counts[label] = (counts[label] || 0) + 1
    })
    return counts
  }, [statusData])

  const filteredData = useMemo(() => {
    if (!statusData) return []
    if (!activeFilter) return statusData
    return statusData.filter((app) => {
      let label = statusUiMap[app.status].label
      if (
        app.status === 'error' &&
        app.ipoName === 'Unknown IPO / Fetch Error'
      ) {
        label = 'Connection Error'
      }
      return label === activeFilter
    })
  }, [statusData, activeFilter])

  return (
    <div className=" mx-auto space-y-6 pb-12">
      <div className="space-y-4">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Landmark className="h-4 w-4" />
          <span>Listed IPO/FPO</span>
        </div>

        {appliedIpos && appliedIpos.length > 0 ? (
          <Popover open={openCombobox} onOpenChange={setOpenCombobox}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                role="combobox"
                aria-expanded={openCombobox}
                className="w-full justify-between bg-transparent border-muted-foreground/30 h-12 rounded-xl hover:bg-white/5 hover:text-foreground font-normal"
              >
                {selectedIpoId
                  ? (() => {
                      const ipo = appliedIpos.find(
                        (i) => String(i.companyShareId) === selectedIpoId,
                      )
                      return ipo ? (
                        <div className="flex items-center gap-2">
                          <Badge
                            variant="outline"
                            className={cn(
                              'text-[10px] uppercase font-bold py-0 tracking-widest',
                              getShareTypeColor(ipo.shareTypeName),
                            )}
                          >
                            {ipo.shareTypeName}
                          </Badge>
                          <span className="font-medium text-sm">
                            {ipo.companyName} ({ipo.scrip})
                          </span>
                        </div>
                      ) : (
                        'Select IPO...'
                      )
                    })()
                  : 'Select IPO...'}
                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent
              className="w-[var(--radix-popover-trigger-width)] p-0 bg-[#1a1a1a] border-border/50"
              align="start"
            >
              <Command className="bg-transparent">
                <CommandInput placeholder="Search IPOs..." className="h-9" />
                <CommandList className="max-h-[300px]">
                  <CommandEmpty>No IPO found.</CommandEmpty>
                  <CommandGroup>
                    {appliedIpos.map((ipo) => (
                      <CommandItem
                        key={ipo.companyShareId}
                        value={ipo.companyName + ' ' + ipo.scrip}
                        onSelect={() => {
                          setSelectedIpoId(String(ipo.companyShareId))
                          setOpenCombobox(false)
                        }}
                        className="cursor-pointer"
                      >
                        <Check
                          className={cn(
                            'mr-2 h-4 w-4',
                            selectedIpoId === String(ipo.companyShareId)
                              ? 'opacity-100 text-green-500'
                              : 'opacity-0',
                          )}
                        />
                        <div className="flex items-center gap-2">
                          <Badge
                            variant="outline"
                            className={cn(
                              'text-[10px] uppercase font-bold py-0 tracking-widest',
                              getShareTypeColor(ipo.shareTypeName),
                            )}
                          >
                            {ipo.shareTypeName}
                          </Badge>
                          <span className="font-medium text-sm">
                            {ipo.companyName} ({ipo.scrip})
                          </span>
                        </div>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
        ) : (
          <div className="h-12 rounded-xl border border-dashed border-border/50 flex items-center justify-center text-muted-foreground text-sm">
            No IPOs found
          </div>
        )}
      </div>

      {isErrorIpos || isErrorStatus ? (
        <ErrorMessage
          message="Failed to fetch live data from MeroShare"
          onRetry={() => {
            void refetchIpos()
            void refetchStatus()
          }}
        />
      ) : !appliedIpos || appliedIpos.length === 0 ? (
        <EmptyState
          icon={<CheckSquare className="h-12 w-12" />}
          title="No applications found"
          description="You haven't applied to any active IPOs or the results are no longer available."
        />
      ) : selectedIpoId ? (
        <div className="space-y-4 pt-6 border-t border-border/50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-medium">IPO/FPO Status Updates</h2>
              <span className="text-green-500 font-medium">
                (
                {statusData?.filter(
                  (d) => d.status === 'applied' || d.status === 'allotted',
                ).length ?? 0}
                /{statusData?.length ?? 0})
              </span>
            </div>
            {activeFilter && (
              <button
                onClick={() => setActiveFilter(null)}
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                clear
              </button>
            )}
          </div>

          {/* Dynamic Filters matching the mockup pills */}
          <div className="flex flex-wrap gap-3 pb-2">
            {Object.entries(filterCounts).map(([label, count]) => {
              // Find the UI map entry for this label to get its color
              const uiMap = Object.values(statusUiMap).find(
                (m) => m.label === label,
              )
              const isActive = activeFilter === label

              return (
                <button
                  key={label}
                  onClick={() => setActiveFilter(isActive ? null : label)}
                  className={cn(
                    'px-4 py-1.5 rounded-full text-sm font-medium transition-all duration-200 border',
                    isActive
                      ? cn(uiMap?.bgClass, uiMap?.borderClass, uiMap?.textClass)
                      : 'border-border/40 text-muted-foreground hover:border-border/80',
                  )}
                  style={isActive && uiMap ? {} : {}}
                >
                  {label} ({count})
                </button>
              )
            })}
          </div>

          {isLoadingStatus ? (
            <div className="space-y-4 mt-6">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="h-28 rounded-2xl bg-white/5 animate-pulse border border-white/5"
                />
              ))}
            </div>
          ) : filteredData.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground border border-dashed border-border/50 rounded-2xl">
              No accounts matching this status.
            </div>
          ) : (
            <div className="space-y-4 mt-4">
              {filteredData.map((app, idx) => {
                let uiMap = statusUiMap[app.status]
                if (
                  app.status === 'error' &&
                  app.ipoName === 'Unknown IPO / Fetch Error'
                ) {
                  uiMap = {
                    ...uiMap,
                    label: 'Connection Error',
                    textClass: 'text-orange-500',
                    bgClass: 'bg-orange-500/10',
                    borderClass: 'border-orange-500/30',
                  }
                }
                const displayName =
                  app.name && app.name.trim() !== '' ? app.name : app.username

                return (
                  <div
                    key={app.id}
                    className={cn(
                      'p-4 rounded-2xl border bg-[#111111] transition-all duration-300 flex justify-between items-stretch gap-4',
                      uiMap.borderClass,
                    )}
                  >
                    <div className="flex gap-4 items-start flex-1">
                      <div
                        className={cn(
                          'p-3 rounded-xl flex-shrink-0 flex items-center justify-center',
                          uiMap.bgClass,
                        )}
                      >
                        {uiMap.icon}
                      </div>
                      <div className="space-y-1.5 pt-1">
                        <div className={cn('font-medium', uiMap.textClass)}>
                          {idx + 1}. {displayName}
                        </div>
                        <div
                          className={cn(
                            'text-sm flex items-center gap-2',
                            uiMap.textClass,
                          )}
                        >
                          <span>
                            {uiMap.label} ( quantity :{' '}
                            {app.quantity ??
                              (app.status === 'allotted' ? '—' : '10')}{' '}
                            )
                          </span>
                          {(app.status === 'not_allotted' ||
                            app.status === 'error' ||
                            app.status === 'not_applied') && (
                            <span>
                              {app.status === 'error' && app.errorMessage
                                ? app.errorMessage
                                : app.status === 'not_applied'
                                  ? app.meroShareRemark
                                  : app.meroShareRemark
                                    ? app.meroShareRemark
                                        .replace(/^Block Amount Status - /, '')
                                        .trim()
                                    : app.status === 'not_allotted'
                                      ? 'Amount Released'
                                      : 'Rejected'}
                            </span>
                          )}
                        </div>

                      </div>
                    </div>

                    {app.status === 'error' &&
                      app.ipoName !== 'Unknown IPO / Fetch Error' &&
                      isIpoOpen && (
                        <Button
                          variant="outline"
                          className="h-auto px-6! rounded-lg! border-green-500/30 text-green-500 hover:bg-green-500/10 font-medium whitespace-nowrap"
                          onClick={() =>
                            void reapplyMutation.mutate({
                              accountId: app.brokerAccountId,
                              applicantFormId: Number(app.id),
                            })
                          }
                          disabled={reapplyMutation.isPending}
                        >
                          {reapplyMutation.isPending &&
                          reapplyMutation.variables.accountId ===
                            app.brokerAccountId ? (
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          ) : (
                            <RefreshCw className="h-4 w-4 mr-2" />
                          )}
                          Reapply
                        </Button>
                      )}
                    {app.status === 'error' &&
                      app.ipoName === 'Unknown IPO / Fetch Error' && (
                        <Button
                          variant="outline"
                          className="h-auto px-6 border-orange-500/30 text-orange-500 hover:bg-orange-500/10 font-medium whitespace-nowrap"
                          onClick={() => void refetchStatus()}
                          disabled={isRefetchingStatus}
                        >
                          {isRefetchingStatus ? (
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          ) : (
                            <RefreshCw className="h-4 w-4 mr-2" />
                          )}
                          Retry
                        </Button>
                      )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      ) : null}
    </div>
  )
}
