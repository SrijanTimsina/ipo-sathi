import { createFileRoute, Link } from '@tanstack/react-router'
import { useState } from 'react'
import { ProtectedRoute } from '#/shared/components/ProtectedRoute'
import { AppLayout } from '#/shared/components/AppLayout'
import {
  useAccounts,
  useDeleteAccount,
  useUpdateAccount,
} from '#/app/accounts/api/accounts.queries'
import { TableSkeleton } from '#/shared/components/LoadingSkeleton'
import { ErrorMessage, EmptyState } from '#/shared/components/ErrorMessage'
import { Button } from '#/components/ui/button'
import { Switch } from '#/components/ui/switch'
import { Card, CardContent, CardHeader, CardTitle } from '#/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '#/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '#/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '#/components/ui/dropdown-menu'
import { toast } from 'sonner'
import { Plus, Pencil, Trash2, Wallet, Download, MoreVertical, Zap, RefreshCw } from 'lucide-react'
import { cn } from '#/lib/utils'
import type { BrokerAccount } from '#/shared/types/api'
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  createColumnHelper,
} from '@tanstack/react-table'

export const Route = createFileRoute('/accounts/')({
  component: AccountsPage,
})

function AccountsPage() {
  return (
    <ProtectedRoute>
      <AppLayout>
        <AccountsContent />
      </AppLayout>
    </ProtectedRoute>
  )
}

function AccountsContent() {
  const [page, setPage] = useState(1)
  const [deleteTarget, setDeleteTarget] = useState<BrokerAccount | null>(null)

  const { data, isLoading, isError, refetch } = useAccounts(page)
  const deleteAccount = useDeleteAccount()

  const updateAccountMutation = useUpdateAccount({
    onSuccess: () => toast.success('Account preferences updated'),
    onError: () => toast.error('Failed to update account'),
  })

  async function handleDelete(): Promise<void> {
    if (!deleteTarget) return
    try {
      await deleteAccount.mutateAsync(deleteTarget.id)
      toast.success('Account deleted successfully')
      setDeleteTarget(null)
    } catch {
      toast.error('Failed to delete account')
    }
  }

  const columnHelper = createColumnHelper<BrokerAccount>()
  const columns = [
    columnHelper.accessor((row) => row.name || '-', {
      id: 'name',
      header: 'Name',
      cell: (info) => (
        <div className="flex items-center gap-2">
          <span className="font-medium">{info.getValue()}</span>
          <AccountStatusBadges account={info.row.original} />
        </div>
      ),
    }),
    columnHelper.accessor((row) => row.demat || '-', {
      id: 'demat',
      header: 'Demat',
    }),
    columnHelper.accessor(
      (row) => row.clientCode || row.clientId,
      {
        id: 'dp',
        header: 'DP',
      },
    ),
    columnHelper.accessor('username', {
      id: 'username',
      header: 'Username',
    }),
    columnHelper.accessor((row) => row.password || '-', {
      id: 'password',
      header: 'Password',
    }),
    columnHelper.accessor((row) => row.pin || '-', {
      id: 'pin',
      header: 'PIN',
    }),
    columnHelper.accessor('crn', {
      id: 'crn',
      header: 'CRN',
    }),
    columnHelper.display({
      id: 'actions',
      header: () => <div className="text-right">Actions</div>,
      cell: (info) => (
        <div className="flex justify-end">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                <span className="sr-only">Open menu</span>
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuLabel>Preferences</DropdownMenuLabel>
              <DropdownMenuItem onSelect={(e) => e.preventDefault()} className="flex items-center justify-between">
                <span>Active</span>
                <Switch
                  checked={info.row.original.isActive}
                  onCheckedChange={(checked) =>
                    updateAccountMutation.mutate({
                      id: info.row.original.id,
                      payload: { isActive: checked },
                    })
                  }
                  disabled={updateAccountMutation.isPending}
                />
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={(e) => e.preventDefault()} className="flex items-center justify-between">
                <span>Auto Apply</span>
                <Switch
                  checked={info.row.original.autoApply}
                  onCheckedChange={(checked) =>
                    updateAccountMutation.mutate({
                      id: info.row.original.id,
                      payload: { autoApply: checked },
                    })
                  }
                  disabled={updateAccountMutation.isPending}
                />
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={(e) => e.preventDefault()} className="flex items-center justify-between">
                <span>Auto ReApply</span>
                <Switch
                  checked={info.row.original.autoReApply}
                  onCheckedChange={(checked) =>
                    updateAccountMutation.mutate({
                      id: info.row.original.id,
                      payload: { autoReApply: checked },
                    })
                  }
                  disabled={updateAccountMutation.isPending}
                />
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link to="/accounts/$id" params={{ id: info.row.original.id }} className="cursor-pointer">
                  <Pencil className="h-4 w-4 mr-2" /> Edit Account
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem
                className="text-destructive focus:text-destructive cursor-pointer"
                onClick={() => setDeleteTarget(info.row.original)}
              >
                <Trash2 className="h-4 w-4 mr-2" /> Delete Account
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      ),
    }),
  ]

  const table = useReactTable({
    data: data?.data ?? [],
    columns,
    getCoreRowModel: getCoreRowModel(),
  })

  function exportCSV() {
    if (!data || data.data.length === 0) return

    const headers = [
      'Name',
      'Demat',
      'DP',
      'Username',
      'Password',
      'PIN',
      'CRN',
    ]
    const csvRows = [headers.join(',')]

    data.data.forEach((account) => {
      const dp = account.clientCode || account.clientId
      const rowData = [
        `"${String(account.name || '-').replace(/"/g, '""')}"`,
        `"${String(account.demat || '-').replace(/"/g, '""')}"`,
        `"${String(dp).replace(/"/g, '""')}"`,
        `"${String(account.username).replace(/"/g, '""')}"`,
        `"${String(account.password || '-').replace(/"/g, '""')}"`,
        `"${String(account.pin || '-').replace(/"/g, '""')}"`,
        `"${String(account.crn).replace(/"/g, '""')}"`,
      ]
      csvRows.push(rowData.join(','))
    })

    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'accounts_export.csv'
    a.click()
    window.URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">MeroShare Accounts</h1>
        </div>
        <div className="flex items-center gap-2">
          <Button asChild id="add-account-btn">
            <Link to="/accounts/new">
              <Plus className="h-4 w-4 mr-2" />
              Add Account
            </Link>
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-4">
          <CardTitle className="text-base">
            {data
              ? `${data.total} account${data.total !== 1 ? 's' : ''}`
              : 'Your Accounts'}
          </CardTitle>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={exportCSV}
              disabled={!data || data.data.length === 0}
              className="cursor-pointer"
            >
              <Download className="mr-2 h-4 w-4" />
              Export CSV
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <TableSkeleton />
          ) : isError ? (
            <ErrorMessage
              message="Failed to load accounts"
              onRetry={() => void refetch()}
            />
          ) : !data || data.data.length === 0 ? (
            <EmptyState
              icon={<Wallet className="h-12 w-12" />}
              title="No MeroShare accounts yet"
              description="Add your MeroShare accounts to start applying for IPOs in bulk."
              action={
                <Button asChild>
                  <Link to="/accounts/new">
                    <Plus className="h-4 w-4 mr-2" />
                    Add Your First Account
                  </Link>
                </Button>
              }
            />
          ) : (
            <>
              {/* Desktop Table View */}
              <div className="hidden md:block">
                <Table>
                  <TableHeader>
                    {table.getHeaderGroups().map((headerGroup) => (
                      <TableRow key={headerGroup.id}>
                        {headerGroup.headers.map((header) => (
                          <TableHead key={header.id}>
                            {header.isPlaceholder
                              ? null
                              : flexRender(
                                  header.column.columnDef.header,
                                  header.getContext(),
                                )}
                          </TableHead>
                        ))}
                      </TableRow>
                    ))}
                  </TableHeader>
                  <TableBody>
                    {table.getRowModel().rows.map((row) => (
                      <TableRow key={row.id}>
                        {row.getVisibleCells().map((cell) => (
                          <TableCell key={cell.id}>
                            {flexRender(
                              cell.column.columnDef.cell,
                              cell.getContext(),
                            )}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Mobile Card View */}
              <div className="md:hidden grid gap-4">
                {table.getRowModel().rows.map((row) => (
                  <Card key={row.id}>
                    <CardContent className="p-4 space-y-3">
                      <div className="flex items-center justify-between border-b pb-3">
                        <div className="font-semibold text-lg flex items-center gap-2">
                          {row.original.name || '-'}
                          <AccountStatusBadges account={row.original} />
                        </div>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                              <span className="sr-only">Open menu</span>
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-48">
                            <DropdownMenuLabel>Preferences</DropdownMenuLabel>
                            <DropdownMenuItem onSelect={(e) => e.preventDefault()} className="flex items-center justify-between">
                              <span>Active</span>
                              <Switch
                                checked={row.original.isActive}
                                onCheckedChange={(checked) =>
                                  updateAccountMutation.mutate({
                                    id: row.original.id,
                                    payload: { isActive: checked },
                                  })
                                }
                                disabled={updateAccountMutation.isPending}
                              />
                            </DropdownMenuItem>
                            <DropdownMenuItem onSelect={(e) => e.preventDefault()} className="flex items-center justify-between">
                              <span>Auto Apply</span>
                              <Switch
                                checked={row.original.autoApply}
                                onCheckedChange={(checked) =>
                                  updateAccountMutation.mutate({
                                    id: row.original.id,
                                    payload: { autoApply: checked },
                                  })
                                }
                                disabled={updateAccountMutation.isPending}
                              />
                            </DropdownMenuItem>
                            <DropdownMenuItem onSelect={(e) => e.preventDefault()} className="flex items-center justify-between">
                              <span>Auto ReApply</span>
                              <Switch
                                checked={row.original.autoReApply}
                                onCheckedChange={(checked) =>
                                  updateAccountMutation.mutate({
                                    id: row.original.id,
                                    payload: { autoReApply: checked },
                                  })
                                }
                                disabled={updateAccountMutation.isPending}
                              />
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem asChild>
                              <Link to="/accounts/$id" params={{ id: row.original.id }} className="cursor-pointer">
                                <Pencil className="h-4 w-4 mr-2" /> Edit Account
                              </Link>
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              className="text-destructive focus:text-destructive cursor-pointer"
                              onClick={() => setDeleteTarget(row.original)}
                            >
                              <Trash2 className="h-4 w-4 mr-2" /> Delete Account
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div className="text-muted-foreground">Demat</div>
                        <div className="font-medium text-right break-all">
                          {row.original.demat || '-'}
                        </div>

                        <div className="text-muted-foreground">DP</div>
                        <div className="font-medium text-right break-all">
                          {row.original.clientCode || row.original.clientId}
                        </div>

                        <div className="text-muted-foreground">Username</div>
                        <div className="font-medium text-right break-all">
                          {row.original.username}
                        </div>

                        <div className="text-muted-foreground">Password</div>
                        <div className="font-medium text-right break-all">
                          {row.original.password || '-'}
                        </div>

                        <div className="text-muted-foreground">PIN</div>
                        <div className="font-medium text-right break-all">
                          {row.original.pin || '-'}
                        </div>

                        <div className="text-muted-foreground">CRN</div>
                        <div className="font-medium text-right break-all">
                          {row.original.crn}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              {/* Pagination */}
              {data.totalPages > 1 && (
                <div className="flex items-center justify-between mt-4 pt-4 border-t">
                  <p className="text-sm text-muted-foreground">
                    Page {data.page} of {data.totalPages}
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={page === 1}
                      onClick={() => setPage((p) => p - 1)}
                    >
                      Previous
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={page === data.totalPages}
                      onClick={() => setPage((p) => p + 1)}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={deleteTarget !== null}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Account</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete the account{' '}
              <strong>{deleteTarget?.username}</strong>? This action cannot be
              undone and will remove all associated IPO application records.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => void handleDelete()}
              disabled={deleteAccount.isPending}
            >
              {deleteAccount.isPending ? 'Deleting…' : 'Delete Account'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
function AccountStatusBadges({ account }: { account: BrokerAccount }) {
  return (
    <div className="flex items-center gap-1.5 ml-1">
      <div
        className={cn(
          'w-2 h-2 rounded-full',
          account.isActive
            ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]'
            : 'bg-neutral-300',
        )}
        title={account.isActive ? 'Active' : 'Inactive'}
      />
      {account.autoApply && (
        <span title="Auto Apply Enabled">
          <Zap className="w-3.5 h-3.5 text-blue-500 fill-blue-500/20" />
        </span>
      )}
      {account.autoReApply && (
        <span title="Auto Re-Apply Enabled">
          <RefreshCw className="w-3.5 h-3.5 text-emerald-500" />
        </span>
      )}
    </div>
  )
}
