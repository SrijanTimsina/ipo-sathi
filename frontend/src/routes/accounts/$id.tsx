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
import { ArrowLeft, Check, ChevronsUpDown } from 'lucide-react'
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
        bankId: account.bankId ?? (banks?.length === 1 ? banks[0].id : undefined),
        isActive: account.isActive,
        autoApply: account.autoApply,
        autoReApply: account.autoReApply,
      })
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
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => router.history.back()}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold">Edit Account</h1>
          <p className="text-muted-foreground text-sm">
            {account.name || account.username}
          </p>
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
                              ? banks?.find(b => b.id === field.value)?.name
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
                          <FormLabel className="text-base">Auto Apply</FormLabel>
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
    </div>
  )
}
