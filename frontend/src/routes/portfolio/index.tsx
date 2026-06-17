import { useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { ProtectedRoute } from '#/shared/components/ProtectedRoute'
import { AppLayout } from '#/shared/components/AppLayout'
import { usePortfolio } from '#/app/portfolio/api/portfolio.queries'
import { Card, CardContent, CardHeader, CardTitle } from '#/components/ui/card'
import { Badge } from '#/components/ui/badge'
import { Button } from '#/components/ui/button'
import { Skeleton } from '#/components/ui/skeleton'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '#/components/ui/dialog'
import { Checkbox } from '#/components/ui/checkbox'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '#/components/ui/table'
import {
  Briefcase,
  ChevronDown,
  ChevronRight,
  Download,
  RefreshCw,
  AlertCircle,
  TrendingUp,
  TrendingDown,
  BarChart3,
} from 'lucide-react'
import type { AccountPortfolio, PortfolioHolding } from '#/shared/types/api'
import ExcelJS from 'exceljs'
import { saveAs } from 'file-saver'

export const Route = createFileRoute('/portfolio/')({
  component: PortfolioPage,
})

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatNPR(value: number): string {
  return `Rs. ${value.toLocaleString('en-NP', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function addPortfolioSheet(
  workbook: ExcelJS.Workbook,
  sheetName: string,
  title: string,
  holdings: Array<{ script: string; scriptDesc: string; qty: number; ltp: number; value: number }>,
  totalValue: number
) {
  let finalSheetName = sheetName.replace(/[\]\\[*?:/]/g, '').trim().substring(0, 31)
  if (!finalSheetName) finalSheetName = 'Portfolio'
  let tryName = finalSheetName
  let i = 1
  while (workbook.getWorksheet(tryName)) {
    tryName = `${finalSheetName.substring(0, 28)}_${i}`
    i++
  }
  const sheet = workbook.addWorksheet(tryName)

  sheet.mergeCells('A1:F1')
  const titleCell = sheet.getCell('A1')
  titleCell.value = title
  titleCell.font = { bold: true, size: 14 }
  titleCell.alignment = { horizontal: 'center', vertical: 'middle' }

  const headerRow = sheet.addRow(['S.N', 'Scrip', 'Share Name', 'QTY', 'LTP', 'Value'])
  headerRow.font = { bold: true }
  headerRow.alignment = { horizontal: 'center', vertical: 'middle' }

  holdings.forEach((h, index) => {
    const shareName = h.scriptDesc.replace(/\s*-\s*ORDINARY SHARE\s*$/i, '')
    const row = sheet.addRow([
      index + 1,
      h.script,
      shareName,
      h.qty,
      h.ltp,
      h.value
    ])
    row.getCell(4).numFmt = '#,##0'
    row.getCell(5).numFmt = '#,##0.00'
    row.getCell(6).numFmt = '#,##0.00'
  })

  const totalRow = sheet.addRow(['TOTAL', '', '', '', '', totalValue])
  sheet.mergeCells(`A${totalRow.number}:E${totalRow.number}`)
  const totalLabelCell = sheet.getCell(`A${totalRow.number}`)
  totalLabelCell.alignment = { horizontal: 'center', vertical: 'middle' }
  totalLabelCell.font = { bold: true }
  const totalValueCell = sheet.getCell(`F${totalRow.number}`)
  totalValueCell.font = { bold: true }
  totalValueCell.numFmt = '#,##0.00'

  const rowCount = totalRow.number
  for (let r = 1; r <= rowCount; r++) {
    for (let c = 1; c <= 6; c++) {
      const cell = sheet.getCell(r, c)
      cell.border = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' }
      }
    }
  }

  sheet.getColumn(1).width = 5
  sheet.getColumn(2).width = 10
  sheet.getColumn(3).width = 40
  sheet.getColumn(4).width = 10
  sheet.getColumn(5).width = 15
  sheet.getColumn(6).width = 20
}

async function exportExcel(accounts: AccountPortfolio[]): Promise<void> {
  const workbook = new ExcelJS.Workbook()

  // 1. Combined Portfolio
  if (accounts.length > 0) {
    const combinedHoldings = new Map<string, { script: string; scriptDesc: string; qty: number; ltp: number; value: number }>()
    
    accounts.forEach(account => {
      account.holdings.forEach(h => {
        const existing = combinedHoldings.get(h.script)
        if (existing) {
          existing.qty += h.currentBalance
          existing.value = existing.qty * existing.ltp
        } else {
          combinedHoldings.set(h.script, {
            script: h.script,
            scriptDesc: h.scriptDesc,
            qty: h.currentBalance,
            ltp: h.lastTransactionPrice,
            value: h.valueOfLastTransPrice
          })
        }
      })
    })

    const sortedCombined = Array.from(combinedHoldings.values()).sort((a, b) => a.script.localeCompare(b.script))
    const totalCombinedValue = sortedCombined.reduce((sum, h) => sum + h.value, 0)

    addPortfolioSheet(
      workbook,
      'Combined Portfolio',
      'Combined Portfolio',
      sortedCombined,
      totalCombinedValue
    )
  }

  // 2. Individual Portfolios
  accounts.forEach((account) => {
    let totalValue = 0
    const mappedHoldings = account.holdings.map(h => {
      totalValue += h.valueOfLastTransPrice
      return {
        script: h.script,
        scriptDesc: h.scriptDesc,
        qty: h.currentBalance,
        ltp: h.lastTransactionPrice,
        value: h.valueOfLastTransPrice
      }
    })

    addPortfolioSheet(
      workbook,
      account.accountName ?? 'Unknown',
      account.accountName ?? 'Unknown',
      mappedHoldings,
      totalValue
    )
  })

  const buffer = await workbook.xlsx.writeBuffer()
  const timestamp = new Date().toISOString().split('T')[0]
  saveAs(new Blob([buffer]), `portfolio_${timestamp}.xlsx`)
}

// ─── Page Component ───────────────────────────────────────────────────────────

function PortfolioPage() {
  return (
    <ProtectedRoute>
      <AppLayout>
        <PortfolioContent />
      </AppLayout>
    </ProtectedRoute>
  )
}

function PortfolioContent() {
  const { data, isLoading, isRefetching, refetch } = usePortfolio()
  const [expandedAccounts, setExpandedAccounts] = useState<Set<string>>(
    new Set(),
  )
  const [exportDialogOpen, setExportDialogOpen] = useState(false)

  function toggleExpand(accountId: string) {
    setExpandedAccounts((prev) => {
      const next = new Set(prev)
      if (next.has(accountId)) {
        next.delete(accountId)
      } else {
        next.add(accountId)
      }
      return next
    })
  }

  const successAccounts = data?.accounts.filter((a) => !a.error) ?? []
  const grandTotal = data?.grandTotalValue ?? 0
  const totalStocks = successAccounts.reduce((sum, a) => sum + a.totalItems, 0)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Briefcase className="h-6 w-6" />
            Portfolio
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => void refetch()}
            disabled={isRefetching}
          >
            <RefreshCw
              className={`h-4 w-4 mr-2 ${isRefetching ? 'animate-spin' : ''}`}
            />
            Refresh
          </Button>
          <ExportDialog
            accounts={data?.accounts ?? []}
            open={exportDialogOpen}
            onOpenChange={setExportDialogOpen}
            disabled={isLoading || !data?.accounts.length}
          />
        </div>
      </div>

      {/* Summary Cards */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card className="border-emerald-500/20 bg-gradient-to-br from-emerald-500/5 to-transparent">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">
                    Total Portfolio Value
                  </p>
                  <p className="text-2xl font-bold mt-1 text-emerald-400">
                    {formatNPR(grandTotal)}
                  </p>
                </div>
                <div className="p-3 rounded-full bg-emerald-500/10 text-emerald-400">
                  <TrendingUp className="h-5 w-5" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-blue-500/20 bg-gradient-to-br from-blue-500/5 to-transparent">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">
                    Active Accounts
                  </p>
                  <p className="text-2xl font-bold mt-1 text-blue-400">
                    {data?.accounts.length ?? 0}
                  </p>
                </div>
                <div className="p-3 rounded-full bg-blue-500/10 text-blue-400">
                  <Briefcase className="h-5 w-5" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-violet-500/20 bg-gradient-to-br from-violet-500/5 to-transparent">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">
                    Total Stocks Held
                  </p>
                  <p className="text-2xl font-bold mt-1 text-violet-400">
                    {totalStocks}
                  </p>
                </div>
                <div className="p-3 rounded-full bg-violet-500/10 text-violet-400">
                  <BarChart3 className="h-5 w-5" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Account Cards */}
      {isLoading ? (
        <div className="space-y-4">
          {[1, 2].map((i) => (
            <Skeleton key={i} className="h-36" />
          ))}
        </div>
      ) : data?.accounts.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Briefcase className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-lg font-medium">No accounts found</p>
            <p className="text-muted-foreground mt-1">
              Add broker accounts to view your portfolio
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {data?.accounts.map((account) => (
            <AccountCard
              key={account.accountId}
              account={account}
              isExpanded={expandedAccounts.has(account.accountId)}
              onToggle={() => toggleExpand(account.accountId)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Account Card ─────────────────────────────────────────────────────────────

function AccountCard({
  account,
  isExpanded,
  onToggle,
}: {
  account: AccountPortfolio
  isExpanded: boolean
  onToggle: () => void
}) {
  const hasError = Boolean(account.error)

  return (
    <Card
      className={`transition-all duration-200 ${
        hasError ? 'border-red-500/30 bg-red-500/5' : 'hover:border-white/20'
      }`}
    >
      {/* Card Header — always visible, clickable */}
      <button
        type="button"
        className="w-full text-left"
        onClick={onToggle}
        disabled={hasError && account.holdings.length === 0}
      >
        <CardHeader className={`p-5 ${isExpanded ? 'pb-3' : ''}`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {!hasError && (
                <div className="text-muted-foreground transition-transform duration-200">
                  {isExpanded ? (
                    <ChevronDown className="h-5 w-5" />
                  ) : (
                    <ChevronRight className="h-5 w-5" />
                  )}
                </div>
              )}
              <div>
                <CardTitle className="text-base flex items-center gap-2">
                  {account.accountName ?? 'Unknown Account'}
                  {hasError && (
                    <Badge
                      variant="destructive"
                      className="text-xs font-normal"
                    >
                      <AlertCircle className="h-3 w-3 mr-1" />
                      Error
                    </Badge>
                  )}
                </CardTitle>
                <p className="text-xs text-muted-foreground mt-0.5 font-mono">
                  DEMAT: {account.demat ?? 'N/A'}
                </p>
              </div>
            </div>

            {!hasError && (
              <div className="text-right">
                <p className="text-lg font-bold text-emerald-400">
                  {formatNPR(account.totalValue)}
                </p>
                <div className="flex items-center gap-2 justify-end">
                  <Badge variant="secondary" className="text-xs">
                    {account.totalItems} stock
                    {account.totalItems !== 1 ? 's' : ''}
                  </Badge>
                  <PriceChange
                    current={account.totalValue}
                    previous={account.totalValuePrevClose}
                  />
                </div>
              </div>
            )}
          </div>
        </CardHeader>
      </button>

      {/* Error message */}
      {hasError && (
        <CardContent className="pt-0 pb-4">
          <p className="text-sm text-red-400">{account.error}</p>
        </CardContent>
      )}

      {/* Expanded holdings table */}
      {isExpanded && !hasError && account.holdings.length > 0 && (
        <CardContent className="pt-0 pb-4">
          <div className="rounded-lg border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="font-semibold">Script</TableHead>
                  <TableHead className="font-semibold text-right">
                    Qty
                  </TableHead>
                  <TableHead className="font-semibold text-right">
                    LTP
                  </TableHead>
                  <TableHead className="font-semibold text-right">
                    Value
                  </TableHead>
                  <TableHead className="font-semibold text-right hidden lg:table-cell">
                    Change
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {account.holdings.map((holding) => (
                  <HoldingRow key={holding.script} holding={holding} />
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      )}

      {isExpanded && !hasError && account.holdings.length === 0 && (
        <CardContent className="pt-0 pb-4">
          <p className="text-sm text-muted-foreground text-center py-4">
            No holdings in this account
          </p>
        </CardContent>
      )}
    </Card>
  )
}

// ─── Holding Row ──────────────────────────────────────────────────────────────

function HoldingRow({ holding }: { holding: PortfolioHolding }) {
  return (
    <TableRow className="hover:bg-muted/30 transition-colors">
      <TableCell className="font-medium">
        <span className="text-sm font-semibold">{holding.script}</span>
      </TableCell>
      <TableCell className="text-right tabular-nums">
        {holding.currentBalance}
      </TableCell>
      <TableCell className="text-right tabular-nums">
        {holding.lastTransactionPrice.toLocaleString('en-NP', {
          minimumFractionDigits: 2,
        })}
      </TableCell>
      <TableCell className="text-right tabular-nums font-medium">
        {formatNPR(holding.valueOfLastTransPrice)}
      </TableCell>
      <TableCell className="text-right hidden lg:table-cell">
        <PriceChange
          current={holding.lastTransactionPrice}
          previous={holding.previousClosingPrice}
        />
      </TableCell>
    </TableRow>
  )
}

// ─── Price Change Badge ───────────────────────────────────────────────────────

function PriceChange({
  current,
  previous,
}: {
  current: number
  previous: number
}) {
  if (previous === 0) return null
  const diff = current - previous
  const isUp = diff > 0
  const isDown = diff < 0

  return (
    <span
      className={`inline-flex items-center gap-0.5 text-xs font-medium ${
        isUp
          ? 'text-emerald-400'
          : isDown
            ? 'text-red-400'
            : 'text-muted-foreground'
      }`}
    >
      {isUp ? (
        <TrendingUp className="h-3 w-3" />
      ) : isDown ? (
        <TrendingDown className="h-3 w-3" />
      ) : null}
      {isUp ? '+' : ''}
      {diff.toFixed(2)}
    </span>
  )
}

// ─── Export Dialog ─────────────────────────────────────────────────────────────

function ExportDialog({
  accounts,
  open,
  onOpenChange,
  disabled,
}: {
  accounts: AccountPortfolio[]
  open: boolean
  onOpenChange: (open: boolean) => void
  disabled?: boolean
}) {
  const validAccounts = accounts.filter((a) => !a.error)
  const [selected, setSelected] = useState<Set<string>>(new Set())

  const allSelected =
    validAccounts.length > 0 && selected.size === validAccounts.length

  function toggleAll() {
    if (allSelected) {
      setSelected(new Set())
    } else {
      setSelected(new Set(validAccounts.map((a) => a.accountId)))
    }
  }

  function toggleAccount(accountId: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(accountId)) {
        next.delete(accountId)
      } else {
        next.add(accountId)
      }
      return next
    })
  }

  async function handleExport() {
    const selectedAccounts = validAccounts.filter((a) =>
      selected.has(a.accountId),
    )
    if (selectedAccounts.length === 0) return

    await exportExcel(selectedAccounts)
    onOpenChange(false)
  }

  // Reset selection when dialog opens
  function handleOpenChange(isOpen: boolean) {
    if (isOpen) {
      setSelected(new Set(validAccounts.map((a) => a.accountId)))
    }
    onOpenChange(isOpen)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button size="sm" disabled={disabled}>
          <Download className="h-4 w-4 mr-2" />
          Export
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Export Portfolio</DialogTitle>
          <DialogDescription>
            Select accounts to include in the Excel export. Each account's
            portfolio will be in a separate sheet.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 my-4">
          {/* Select All */}
          <label className="flex items-center gap-3 p-3 rounded-lg border bg-muted/30 cursor-pointer hover:bg-muted/50 transition-colors">
            <Checkbox
              id="select-all"
              checked={allSelected}
              onCheckedChange={toggleAll}
            />
            <div>
              <span className="text-sm font-medium">Select All</span>
              <p className="text-xs text-muted-foreground">
                {validAccounts.length} account
                {validAccounts.length !== 1 ? 's' : ''} available
              </p>
            </div>
          </label>

          {/* Individual accounts */}
          <div className="max-h-64 overflow-y-auto space-y-2">
            {validAccounts.map((account) => (
              <label
                key={account.accountId}
                className="flex items-center gap-3 p-3 rounded-lg border cursor-pointer hover:bg-muted/30 transition-colors"
              >
                <Checkbox
                  checked={selected.has(account.accountId)}
                  onCheckedChange={() => toggleAccount(account.accountId)}
                />
                <div className="flex-1 min-w-0">
                  <span className="text-sm font-medium truncate block">
                    {account.accountName ?? 'Unknown'}
                  </span>
                  <span className="text-xs text-muted-foreground font-mono">
                    {account.demat ?? 'N/A'}
                  </span>
                </div>
                <span className="text-sm font-medium text-emerald-400 shrink-0">
                  {formatNPR(account.totalValue)}
                </span>
              </label>
            ))}
          </div>

          {validAccounts.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">
              No accounts with portfolio data available for export
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleExport} disabled={selected.size === 0}>
            <Download className="h-4 w-4 mr-2" />
            Export {selected.size > 0 ? `(${selected.size})` : ''}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
