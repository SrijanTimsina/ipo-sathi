import { useState, useMemo, useEffect } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { ProtectedRoute } from '#/shared/components/ProtectedRoute'
import { AppLayout } from '#/shared/components/AppLayout'
import { useAccounts } from '#/app/accounts/api/accounts.queries'
import { useIpoStatus } from '#/app/ipo/api/ipo.queries'
import { ErrorMessage, EmptyState } from '#/shared/components/ErrorMessage'
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
  ChevronsUpDown,
  Check,
  Loader2,
  RefreshCw,
  Info,
} from 'lucide-react'
import type { IpoStatus } from '#/shared/types/api'
import { cn } from '#/lib/utils'

export const Route = createFileRoute('/ipo/results')({
  component: IpoResultsPage,
})

function IpoResultsPage() {
  return (
    <ProtectedRoute>
      <AppLayout>
        <IpoResultsContent />
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
    solidBgClass: string
  }
> = {
  applied: {
    label: 'Verified',
    color: 'text-blue-500',
    bgClass: 'bg-blue-500/10',
    solidBgClass: 'bg-blue-500',
    borderClass: 'border-blue-500/30',
    textClass: 'text-blue-500',
    icon: <ShieldCheck className="h-8 w-8 text-blue-500" />,
  },
  pending: {
    label: 'Unverified',
    color: 'text-orange-500',
    bgClass: 'bg-orange-500/10',
    solidBgClass: 'bg-orange-500',
    borderClass: 'border-orange-500/30',
    textClass: 'text-orange-500',
    icon: <Clock className="h-8 w-8 text-orange-500" />,
  },
  allotted: {
    label: 'Allotted',
    color: 'text-green-500',
    bgClass: 'bg-green-500/10',
    solidBgClass: 'bg-green-500',
    borderClass: 'border-green-500/30',
    textClass: 'text-green-500',
    icon: <ShieldCheck className="h-8 w-8 text-green-500" />,
  },
  not_allotted: {
    label: 'Not Allotted',
    color: 'text-gray-400',
    bgClass: 'bg-gray-400/10',
    solidBgClass: 'bg-gray-500',
    borderClass: 'border-gray-400/30',
    textClass: 'text-gray-400',
    icon: <ShieldAlert className="h-8 w-8 text-gray-400" />,
  },
  error: {
    label: 'Rejected',
    color: 'text-red-500',
    bgClass: 'bg-red-500/10',
    solidBgClass: 'bg-red-500',
    borderClass: 'border-red-500/30',
    textClass: 'text-red-500',
    icon: <XCircle className="h-8 w-8 text-red-500" />,
  },
  not_applied: {
    label: 'Not Applied',
    color: 'text-orange-500',
    bgClass: 'bg-orange-500/10',
    solidBgClass: 'bg-orange-500',
    borderClass: 'border-orange-500/30',
    textClass: 'text-orange-500',
    icon: <Info className="h-8 w-8 text-orange-500" />,
  },
}

function IpoResultsContent() {
  const [selectedAccountId, setSelectedAccountId] = useState<string>('')
  const [openCombobox, setOpenCombobox] = useState(false)
  const [activeFilter, setActiveFilter] = useState<string | null>(null)

  const {
    data: accountsData,
    isError: isErrorAccounts,
    refetch: refetchAccounts,
  } = useAccounts(1, 100)

  const accounts = accountsData?.data || []

  const {
    data: statusData,
    isLoading: isLoadingStatus,
    isError: isErrorStatus,
    isRefetching: isRefetchingStatus,
    refetch: refetchStatus,
  } = useIpoStatus(undefined, selectedAccountId || undefined, {
    enabled: !!selectedAccountId,
  })

  // Auto-select first account if available and nothing is selected
  useEffect(() => {
    if (accounts.length > 0 && !selectedAccountId) {
      setSelectedAccountId(accounts[0].id)
    }
  }, [accounts, selectedAccountId])

  // Calculate filters
  const filterCounts = useMemo(() => {
    if (!statusData) return {}
    const counts: Record<string, number> = {}
    statusData.forEach((app) => {
      const label = statusUiMap[app.status].label
      counts[label] = (counts[label] || 0) + 1
    })
    return counts
  }, [statusData])

  const filteredData = useMemo(() => {
    if (!statusData) return []
    if (!activeFilter) return statusData
    return statusData.filter(
      (app) => statusUiMap[app.status].label === activeFilter,
    )
  }, [statusData, activeFilter])

  return (
    <div className=" mx-auto pb-12">
      {/* Sticky Header containing both Account Selection and Filters */}
      <div className="sticky top-0 z-20 bg-background/95 backdrop-blur-md pb-4 pt-6 -mx-4 px-4 sm:-mx-8 sm:px-8 border-b border-border/20 shadow-sm flex flex-col gap-4">
        {accounts.length > 0 ? (
          <Popover open={openCombobox} onOpenChange={setOpenCombobox}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                role="combobox"
                aria-expanded={openCombobox}
                className="w-full justify-between bg-transparent border-muted-foreground/30 h-12 rounded-xl hover:bg-white/5 hover:text-foreground font-normal"
              >
                {selectedAccountId
                  ? (() => {
                      const account = accounts.find(
                        (i) => i.id === selectedAccountId,
                      )
                      return account ? (
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm">
                            {account.name ||
                              statusData?.[0]?.name ||
                              statusData?.[0]?.username ||
                              account.username}
                          </span>
                          <span className="text-muted-foreground text-xs">
                            ( {account.username} )
                          </span>
                        </div>
                      ) : (
                        'Select Account...'
                      )
                    })()
                  : 'Select Account...'}
                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent
              className="w-[var(--radix-popover-trigger-width)] p-0 bg-[#1a1a1a] border-border/50"
              align="start"
            >
              <Command className="bg-transparent">
                <CommandInput
                  placeholder="Search Accounts..."
                  className="h-9"
                />
                <CommandList className="max-h-[300px]">
                  <CommandEmpty>No account found.</CommandEmpty>
                  <CommandGroup>
                    {accounts.map((account) => (
                      <CommandItem
                        key={account.id}
                        value={account.username + ' ' + account.clientId}
                        onSelect={() => {
                          setSelectedAccountId(account.id)
                          setOpenCombobox(false)
                        }}
                        className="cursor-pointer"
                      >
                        <Check
                          className={cn(
                            'mr-2 h-4 w-4',
                            selectedAccountId === account.id
                              ? 'opacity-100 text-green-500'
                              : 'opacity-0',
                          )}
                        />
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm">
                            {account.name || account.username}
                          </span>
                          <span className="text-muted-foreground text-xs">
                            ( {account.username} )
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
            No accounts found. Please add a MeroShare account.
          </div>
        )}

        {/* Dynamic Filters matching the mockup pills */}
        {selectedAccountId && (
          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => setActiveFilter(null)}
              className={cn(
                'px-4 py-1.5 rounded-full text-sm font-medium transition-all duration-200 border',
                activeFilter === null
                  ? 'bg-foreground text-background border-transparent shadow-md'
                  : 'bg-muted/50 border-border/40 text-muted-foreground hover:bg-muted/80',
              )}
            >
              All ({statusData?.length ?? 0})
            </button>
            {Object.entries(filterCounts).map(([label, count]) => {
              // Find the UI map entry for this label to get its color
              const uiMap = Object.values(statusUiMap).find(
                (m) =>
                  m.label === label ||
                  (label === 'Connection Error' && m.label === 'Rejected'),
              )

              // Override for Connection Error to make it orange
              const isConnectionError = label === 'Connection Error'
              const displayMap = isConnectionError
                ? {
                    solidBgClass: 'bg-orange-500',
                    bgClass: 'bg-orange-500/10',
                    borderClass: 'border-orange-500/30',
                    textClass: 'text-orange-500',
                  }
                : uiMap

              const isActive = activeFilter === label

              return (
                <button
                  key={label}
                  onClick={() => setActiveFilter(isActive ? null : label)}
                  className={cn(
                    'px-4 py-1.5 rounded-full text-sm font-medium transition-all duration-200 border',
                    isActive
                      ? cn(
                          displayMap?.solidBgClass,
                          'text-white border-transparent shadow-md',
                        )
                      : cn(
                          displayMap?.bgClass,
                          displayMap?.borderClass,
                          displayMap?.textClass,
                          'hover:opacity-80',
                        ),
                  )}
                >
                  {label} ({count})
                </button>
              )
            })}
          </div>
        )}
      </div>

      <div className="mt-6 space-y-4">
        {isErrorAccounts || isErrorStatus ? (
          <ErrorMessage
            message="Failed to fetch data"
            onRetry={() => {
              void refetchAccounts()
              void refetchStatus()
            }}
          />
        ) : accounts.length === 0 ? (
          <EmptyState
            icon={<CheckSquare className="h-12 w-12" />}
            title="No accounts added"
            description="You haven't added any MeroShare accounts yet."
          />
        ) : selectedAccountId ? (
          <>
            {isLoadingStatus ? (
              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className="h-28 rounded-2xl bg-white/5 animate-pulse border border-white/5"
                  />
                ))}
              </div>
            ) : filteredData.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground border border-dashed border-border/50 rounded-2xl">
                No applications found for this account.
              </div>
            ) : (
              <div className="space-y-4 mt-4">
                {filteredData.map((app, idx) => {
                  let uiMap = statusUiMap[app.status]
                  const isConnectionError =
                    app.status === 'error' &&
                    app.ipoName === 'Unknown IPO / Fetch Error'
                  if (isConnectionError) {
                    uiMap = {
                      ...uiMap,
                      label: 'Connection Error',
                      solidBgClass: 'bg-orange-500',
                      bgClass: 'bg-orange-500/10',
                      borderClass: 'border-orange-500/30',
                      textClass: 'text-orange-500',
                    }
                  }

                  const displayName = app.ipoName

                  return (
                    <div
                      key={app.id}
                      className={cn(
                        'p-4 rounded-2xl border bg-[#111111] transition-all duration-300',
                        uiMap.borderClass,
                      )}
                    >
                      <div className="flex gap-4 items-start">
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
                              'text-sm flex flex-col gap-0.5 mt-0.5',
                              uiMap.textClass,
                            )}
                          >
                            <span>
                              {uiMap.label} (quantity:{' '}
                              {app.quantity ??
                                (app.status === 'allotted' ? '—' : '10')}
                              )
                            </span>
                            {(app.status === 'not_allotted' ||
                              app.status === 'error') && (
                              <span className="opacity-90 leading-snug">
                                {app.status === 'error' && app.errorMessage
                                  ? app.errorMessage
                                  : app.meroShareRemark
                                    ? app.meroShareRemark
                                        .replace(/^Block Amount Status - /, '')
                                        .trim()
                                    : app.status === 'not_allotted'
                                      ? 'Amount Released'
                                      : 'Rejected'}
                              </span>
                            )}
                            {app.status === 'error' &&
                              app.ipoName === 'Unknown IPO / Fetch Error' && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-6 text-xs ml-2 border-orange-500/30 text-orange-500 hover:bg-orange-500/10"
                                  onClick={() => void refetchStatus()}
                                  disabled={isRefetchingStatus}
                                >
                                  {isRefetchingStatus ? (
                                    <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                                  ) : (
                                    <RefreshCw className="h-3 w-3 mr-1" />
                                  )}
                                  Retry
                                </Button>
                              )}
                          </div>

                          {app.status === 'pending' && (
                            <div className="text-xs px-2 py-1 rounded bg-[#1a1a1a] inline-block mt-1">
                              <span className="text-muted-foreground">
                                {app.meroShareRemark
                                  ? app.meroShareRemark
                                      .replace(/^Block Amount Status - /, '')
                                      .trim()
                                  : 'Generated (Application In-Process at Bank End)'}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </>
        ) : null}
      </div>
    </div>
  )
}
