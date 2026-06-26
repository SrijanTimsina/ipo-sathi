import { useState } from 'react'
import { createFileRoute, useRouter } from '@tanstack/react-router'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { ProtectedRoute } from '#/shared/components/ProtectedRoute'
import { useAuth } from '#/shared/hooks/useAuth'
import { AppLayout } from '#/shared/components/AppLayout'
import { useCreateAccount, useFetchMeroshareBanks } from '#/app/accounts/api/accounts.queries'
import { Button } from '#/components/ui/button'
import { Input } from '#/components/ui/input'
import {
  Card,
  CardContent,
} from '#/components/ui/card'
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
import { useCapitals } from '#/app/ipo/api/ipo.queries'
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

export const Route = createFileRoute('/accounts/new')({
  component: NewAccountPage,
})

const accountSchemaStep1 = z.object({
  clientId: z.string().min(1, 'Client ID is required'),
  username: z.string().min(1, 'Username is required'),
  password: z.string().min(1, 'Password is required'),
})

const accountSchemaStep2 = z.object({
  clientId: z.string(),
  username: z.string(),
  password: z.string(),
  bankId: z.number({ message: 'Bank is required' }),
  crn: z.string().min(1, 'CRN is required'),
  pin: z.string().min(1, 'PIN is required'),
  autoApply: z.boolean().optional(),
  autoReApply: z.boolean().optional(),
})

type AccountFormStep1 = z.infer<typeof accountSchemaStep1>
type AccountFormStep2 = z.infer<typeof accountSchemaStep2>

function NewAccountPage() {
  return (
    <ProtectedRoute>
      <AppLayout>
        <NewAccountContent />
      </AppLayout>
    </ProtectedRoute>
  )
}

function NewAccountContent() {
  const router = useRouter()
  const { isAuthenticated } = useAuth()
  const createAccount = useCreateAccount()
  const fetchBanks = useFetchMeroshareBanks()
  const { data: capitals } = useCapitals()
  
  const [open, setOpen] = useState(false)
  const [step, setStep] = useState<1 | 2>(1)
  const [banks, setBanks] = useState<{ id: number; name: string; code: string }[]>([])

  const formStep1 = useForm<AccountFormStep1>({
    resolver: zodResolver(accountSchemaStep1),
    defaultValues: {
      clientId: '',
      username: '',
      password: '',
    },
  })

  const formStep2 = useForm<AccountFormStep2>({
    resolver: zodResolver(accountSchemaStep2),
    defaultValues: {
      clientId: '',
      username: '',
      password: '',
      crn: '',
      pin: '',
      autoApply: true,
      autoReApply: true,
    },
  })

  async function onStep1Submit(values: AccountFormStep1): Promise<void> {
    try {
      const fetchedBanks = await fetchBanks.mutateAsync(values)
      setBanks(fetchedBanks)
      
      formStep2.reset({
        ...formStep2.getValues(),
        ...values,
        ...(fetchedBanks.length === 1 && { bankId: fetchedBanks[0].id }),
      })
      
      setStep(2)
      toast.success(fetchedBanks.length === 1 ? 'Authenticated successfully. Bank auto-selected.' : 'Authenticated successfully. Please select your bank.')
    } catch (error: any) {
      const errorMessage =
        error?.response?.data?.error?.message ||
        error?.message ||
        'Failed to authenticate with MeroShare. Please check your details.'
      toast.error(errorMessage)
    }
  }

  async function onStep2Submit(values: AccountFormStep2): Promise<void> {
    try {
      await createAccount.mutateAsync(values)
      toast.success('Account added successfully')
      await router.navigate({ to: '/accounts' })
    } catch (error: any) {
      const errorMessage =
        error?.response?.data?.error?.message ||
        error?.message ||
        'Failed to add account. Please check your details.'
      toast.error(errorMessage)
    }
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => {
          if (step === 2) setStep(1)
          else router.history.back()
        }}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold">Add MeroShare Account (Step {step} of 2)</h1>
        </div>
      </div>

      <Card>
        <CardContent>
          {step === 1 && (
            <Form {...formStep1}>
              <form onSubmit={formStep1.handleSubmit(onStep1Submit)} className="space-y-4">
                <FormField
                  control={formStep1.control}
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
                                      formStep1.setValue(
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
                    control={formStep1.control}
                    name="username"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Username</FormLabel>
                        <FormControl>
                          <Input
                            id="username"
                            placeholder="MeroShare username"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={formStep1.control}
                    name="password"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Password</FormLabel>
                        <FormControl>
                          <Input
                            id="account-password"
                            type="text"
                            placeholder="MeroShare password"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <div className="flex gap-3 pt-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => router.history.back()}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={fetchBanks.isPending}>
                    {fetchBanks.isPending ? 'Authenticating…' : 'Next'}
                  </Button>
                </div>
              </form>
            </Form>
          )}

          {step === 2 && (
            <Form {...formStep2}>
              <form onSubmit={formStep2.handleSubmit(onStep2Submit)} className="space-y-4">
                <FormField
                  control={formStep2.control}
                  name="bankId"
                  render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <FormLabel>Bank Account</FormLabel>
                      <Popover>
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
                                ? banks.find(b => b.id === field.value)?.name
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
                                {banks.map((bank) => (
                                  <CommandItem
                                    value={bank.name}
                                    key={bank.id}
                                    onSelect={() => {
                                      formStep2.setValue('bankId', bank.id)
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
                    control={formStep2.control}
                    name="crn"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>CRN Number</FormLabel>
                        <FormControl>
                          <Input id="crn" placeholder="Your CRN" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={formStep2.control}
                    name="pin"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Transaction PIN</FormLabel>
                        <FormControl>
                          <Input
                            id="pin"
                            type="text"
                            placeholder="4-digit PIN"
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
                      control={formStep2.control}
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
                      control={formStep2.control}
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
                <div className="flex gap-3 pt-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setStep(1)}
                  >
                    Back
                  </Button>
                  <Button type="submit" disabled={createAccount.isPending}>
                    {createAccount.isPending ? 'Saving…' : 'Add Account'}
                  </Button>
                </div>
              </form>
            </Form>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

