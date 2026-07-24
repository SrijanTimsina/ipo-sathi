import { createFileRoute, useRouter } from '@tanstack/react-router'
import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { ProtectedRoute } from '#/shared/components/ProtectedRoute'
import { useAuth } from '#/shared/hooks/useAuth'
import { AppLayout } from '#/shared/components/AppLayout'
import {
  useAccount,
  useUpdateAccount,
  useAccountBanks,
} from '#/app/accounts/api/accounts.queries'
import { useCapitals } from '#/app/ipo/api/ipo.queries'
import { PageSkeleton } from '#/shared/components/LoadingSkeleton'
import { ErrorMessage } from '#/shared/components/ErrorMessage'
import { Button } from '#/components/ui/button'
import { Input } from '#/components/ui/input'
import { Card, CardContent } from '#/components/ui/card'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from '#/components/ui/form'
import { Switch } from '#/components/ui/switch'
import {
  ArrowLeft,
  Check,
  ChevronsUpDown,
  AlertCircle,
  Key,
  ExternalLink,
} from 'lucide-react'
import {
  MeroShareBrowserClient,
  MeroShareAuthError,
} from '#/app/ipo/api/ipo.meroshare-client'
import type { MeroShareAuthResponse } from '#/app/ipo/api/ipo.meroshare-client'
import { ChangePasswordDialog } from '#/app/accounts/components/ChangePasswordDialog'
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
import { cn } from '#/lib/utils'
import { Badge } from '#/components/ui/badge'

export const Route = createFileRoute('/accounts/$id')({
  component: EditAccountPage,
})

const updateSchema = z.object({
  clientId: z.string().min(1).optional(),
  username: z.string().min(1).optional(),
  password: z.string().optional(),
  crn: z.string().min(1).optional(),
  pin: z.string().optional(),
  bankId: z.number().optional(),
  isActive: z.boolean().optional(),
  autoApply: z.boolean().optional(),
  autoReApply: z.boolean().optional(),
})

type UpdateForm = z.infer<typeof updateSchema>

function EditAccountPage() {
  return (
    <ProtectedRoute>
      <AppLayout>
        <EditAccountContent />
      </AppLayout>
    </ProtectedRoute>
  )
}

function EditAccountContent() {
  const { id } = Route.useParams()
  const router = useRouter()
  const { isAuthenticated } = useAuth()
  const { data: account, isLoading, isError, refetch } = useAccount(id)
  const updateAccount = useUpdateAccount()
  const { data: capitals } = useCapitals()
  const { data: banks } = useAccountBanks(id)
  const [testStatus, setTestStatus] = useState<{
    loading: boolean
    success?: boolean
    error?: string
    authResponse?: MeroShareAuthResponse
  }>({ loading: false })
  const [passwordChangeOpen, setPasswordChangeOpen] = useState(false)
  const [open, setOpen] = useState(false)
  const [bankOpen, setBankOpen] = useState(false)

  const form = useForm<UpdateForm>({
    resolver: zodResolver(updateSchema),
    defaultValues: {
      clientId: '',
      username: '',
      password: '',
      crn: '',
      pin: '',
      isActive: true,
      autoApply: true,
      autoReApply: true,
    },
  })

  useEffect(() => {
    if (account) {
      form.reset({
        clientId: account.clientId,
        username: account.username,
        crn: account.crn,
        password: account.password || '',
        pin: account.pin || '',
        bankId:
          account.bankId ?? (banks?.length === 1 ? banks[0].id : undefined),
        isActive: account.isActive,
        autoApply: account.autoApply,
        autoReApply: account.autoReApply,
      })

      // Auto-test MeroShare login
      const runTest = async () => {
        setTestStatus({ loading: true })
        try {
          const client = new MeroShareBrowserClient()
          console.log(
            `[Meroshare Test] Authenticating account ${account.username}...`,
          )
          await client.login(
            account.clientId,
            account.username,
            account.password || '',
            true,
          )
          console.log(
            `[Meroshare Test] Account ${account.username} is fully functional.`,
          )
          setTestStatus({ loading: false, success: true })
        } catch (error: any) {
          if (error instanceof MeroShareAuthError) {
            console.error(
              `[Meroshare Test] Account ${account.username} has expired credentials:`,
              error.authResponse.message,
            )
            setTestStatus({
              loading: false,
              success: false,
              authResponse: error.authResponse,
              error: error.authResponse.message,
            })
          } else {
            const exactError =
              error?.response?.data?.message ||
              error?.response?.data?.error ||
              error?.message ||
              'Unknown error'
            console.error(
              `[Meroshare Test] Account ${account.username} failed:`,
              exactError,
            )
            setTestStatus({ loading: false, success: false, error: exactError })
          }
        }
      }

      void runTest()
    }
  }, [account, form, banks])

  async function onSubmit(values: UpdateForm): Promise<void> {
    // Strip empty optional fields, but keep booleans and numbers
    const payload = Object.fromEntries(
      Object.entries(values).filter(([, v]) => {
        if (typeof v === 'boolean' || typeof v === 'number') return true
        return typeof v === 'string' && v.trim() !== ''
      }),
    ) as UpdateForm

    try {
      await updateAccount.mutateAsync({ id, payload })
      toast.success('Account updated successfully')
      await router.navigate({ to: '/accounts' })
    } catch (error: any) {
      const errorMessage =
        error?.response?.data?.error?.message ||
        error?.message ||
        'Failed to update account'
      toast.error(errorMessage)
    }
  }

  if (isLoading) return <PageSkeleton />
  if (isError || !account)
    return (
      <ErrorMessage
        message="Account not found"
        onRetry={() => void refetch()}
      />
    )

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.history.back()}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Edit Account</h1>
            <p className="text-muted-foreground text-sm">
              {account.name || account.username}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {testStatus.loading ? (
            <div className="text-sm px-3 py-1 bg-blue-500/10 text-blue-500 rounded-md animate-pulse">
              Testing connection...
            </div>
          ) : testStatus.success ? (
            <div className="text-sm px-3 py-1 bg-green-500/10 text-green-500 rounded-md font-medium">
              ✅ Connected to MeroShare
            </div>
          ) : testStatus.error ? (
            (() => {
              const auth = testStatus.authResponse
              const needsRenew = auth?.accountExpired || auth?.dematExpired
              const needsPassword = auth?.passwordExpired || auth?.changePassword

              let failureText = 'Failed'
              if (auth?.passwordExpired || auth?.changePassword) failureText = 'Failed: Password Expired'
              else if (auth?.accountExpired) failureText = 'Failed: Meroshare Expired'
              else if (auth?.dematExpired) failureText = 'Failed: Demat Expired'

              return (
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-red-500 flex items-center gap-1.5" title={testStatus.error}>
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    {failureText}
                  </span>
                  {needsRenew && (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs border-red-500/30 text-red-400 hover:bg-red-500/10 hover:text-red-300 transition-colors"
                  asChild
                >
                  <a
                    href="https://meroshare.cdsc.com.np/"
                    target="_blank"
                    rel="noreferrer"
                  >
                    <ExternalLink className="w-3.5 h-3.5 mr-1.5" /> Renew
                    Account
                  </a>
                </Button>
              )}
              {(testStatus.authResponse?.passwordExpired ||
                testStatus.authResponse?.changePassword) && (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs border-red-500/30 text-red-400 hover:bg-red-500/10 hover:text-red-300 transition-colors"
                  onClick={() => setPasswordChangeOpen(true)}
                >
                  <Key className="w-3.5 h-3.5 mr-1.5" /> Change Password
                  </Button>
                )}
              </div>
            )
          })()
        ) : null}
        </div>
      </div>

      <Card>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="clientId"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>Depository Participant (Capital)</FormLabel>
                    <Popover open={open} onOpenChange={setOpen}>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant="outline"
                            role="combobox"
                            className={cn(
                              'w-full justify-between font-normal',
                              !field.value && 'text-muted-foreground',
                            )}
                          >
                            {field.value
                              ? capitals?.find(
                                  (capital) =>
                                    String(capital.id) === field.value,
                                )?.name
                              : 'Select Capital'}
                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0">
                        <Command>
                          <CommandInput placeholder="Search capital or DP code..." />
                          <CommandList>
                            <CommandEmpty>No capital found.</CommandEmpty>
                            <CommandGroup>
                              {capitals?.map((capital) => (
                                <CommandItem
                                  value={`${capital.name} ${capital.code}`}
                                  key={capital.id}
                                  onSelect={() => {
                                    form.setValue(
                                      'clientId',
                                      String(capital.id),
                                    )
                                    setOpen(false)
                                  }}
                                >
                                  <Check
                                    className={cn(
                                      'mr-2 h-4 w-4',
                                      String(capital.id) === field.value
                                        ? 'opacity-100'
                                        : 'opacity-0',
                                    )}
                                  />
                                  {capital.name} ({capital.code})
                                </CommandItem>
                              ))}
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="username"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Username</FormLabel>
                      <FormControl>
                        <Input id="edit-username" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Password</FormLabel>
                      <FormControl>
                        <Input
                          id="edit-password"
                          type="text"
                          placeholder="Password"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="bankId"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>Bank Account</FormLabel>
                    <Popover open={bankOpen} onOpenChange={setBankOpen}>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant="outline"
                            role="combobox"
                            className={cn(
                              'w-full justify-between font-normal',
                              !field.value && 'text-muted-foreground',
                            )}
                          >
                            {field.value
                              ? banks?.find((b) => b.id === field.value)?.name
                              : 'Select Bank'}
                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0">
                        <Command>
                          <CommandInput placeholder="Search bank..." />
                          <CommandList>
                            <CommandEmpty>No bank found.</CommandEmpty>
                            <CommandGroup>
                              {banks?.map((bank) => (
                                <CommandItem
                                  value={bank.name}
                                  key={bank.id}
                                  onSelect={() => {
                                    form.setValue('bankId', bank.id)
                                    setBankOpen(false)
                                  }}
                                >
                                  <Check
                                    className={cn(
                                      'mr-2 h-4 w-4',
                                      bank.id === field.value
                                        ? 'opacity-100'
                                        : 'opacity-0',
                                    )}
                                  />
                                  {bank.name}
                                </CommandItem>
                              ))}
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="crn"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>CRN Number</FormLabel>
                      <FormControl>
                        <Input id="edit-crn" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="pin"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Transaction PIN</FormLabel>
                      <FormControl>
                        <Input
                          id="edit-pin"
                          type="text"
                          placeholder="PIN"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {isAuthenticated && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="autoApply"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                        <div className="space-y-0.5">
                          <FormLabel className="text-base">
                            Auto Apply
                          </FormLabel>
                          <FormDescription>
                            Automatically apply for new IPOs when they open.
                          </FormDescription>
                        </div>
                        <FormControl>
                          <Switch
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="autoReApply"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                        <div className="space-y-0.5">
                          <FormLabel className="text-base">
                            Auto Re-Apply
                          </FormLabel>
                          <FormDescription>
                            Automatically re-apply if the IPO application is
                            rejected.
                          </FormDescription>
                        </div>
                        <FormControl>
                          <Switch
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </div>
              )}

              <FormField
                control={form.control}
                name="isActive"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base">
                        Active Account
                      </FormLabel>
                      <FormDescription>
                        Disable this account to skip it during bulk IPO
                        applications.
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
              <div className="flex gap-3 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => router.history.back()}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={updateAccount.isPending}>
                  {updateAccount.isPending ? 'Saving…' : 'Save Changes'}
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>

      <ChangePasswordDialog
        account={account}
        open={passwordChangeOpen}
        onOpenChange={setPasswordChangeOpen}
        onSuccess={() => {
          setPasswordChangeOpen(false)
          setTestStatus({ loading: true })
          // Re-fetch or re-test the account to verify
          void refetch()
        }}
      />
    </div>
  )
}
