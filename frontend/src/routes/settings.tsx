import { createFileRoute } from '@tanstack/react-router'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { Shield } from 'lucide-react'

import { ProtectedRoute } from '#/shared/components/ProtectedRoute'
import { AppLayout } from '#/shared/components/AppLayout'
import { Button } from '#/components/ui/button'
import { Input } from '#/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '#/components/ui/card'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '#/components/ui/form'
import { apiClient } from '#/shared/lib/axios'
import { useMutation } from '@tanstack/react-query'
import type { ApiSuccess } from '#/shared/types/api'

export const Route = createFileRoute('/settings')({
  component: SettingsPage,
})

const passwordSchema = z.object({
  oldPassword: z.string().min(1, 'Current password is required'),
  newPassword: z.string().min(8, 'New password must be at least 8 characters'),
  confirmPassword: z.string().min(8, 'Please confirm your new password'),
}).refine(data => data.newPassword === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
})

type PasswordForm = z.infer<typeof passwordSchema>

function SettingsPage() {
  return (
    <ProtectedRoute>
      <AppLayout>
        <div className="space-y-6 max-w-2xl mx-auto">
          <div>
            <h1 className="text-2xl font-bold">Settings</h1>
            <p className="text-muted-foreground">Manage your account settings and preferences.</p>
          </div>
          
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="w-5 h-5" />
                Change Password
              </CardTitle>
              <CardDescription>
                Update your password to keep your account secure.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ChangePasswordForm />
            </CardContent>
          </Card>
        </div>
      </AppLayout>
    </ProtectedRoute>
  )
}

function ChangePasswordForm() {
  const form = useForm<PasswordForm>({
    resolver: zodResolver(passwordSchema),
    defaultValues: {
      oldPassword: '',
      newPassword: '',
      confirmPassword: '',
    },
  })

  const changePasswordMutation = useMutation({
    mutationFn: async (values: PasswordForm) => {
      const res = await apiClient.put<ApiSuccess<{ success: boolean }>>('/users/me/password', {
        oldPassword: values.oldPassword,
        newPassword: values.newPassword,
      })
      return res.data
    },
    onSuccess: () => {
      toast.success('Password updated successfully')
      form.reset()
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.message || 'Failed to change password')
    }
  })

  const onSubmit = (values: PasswordForm) => {
    changePasswordMutation.mutate(values)
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="oldPassword"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Current Password</FormLabel>
              <FormControl>
                <Input type="password" placeholder="Enter current password" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="newPassword"
          render={({ field }) => (
            <FormItem>
              <FormLabel>New Password</FormLabel>
              <FormControl>
                <Input type="password" placeholder="Enter new password" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="confirmPassword"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Confirm New Password</FormLabel>
              <FormControl>
                <Input type="password" placeholder="Confirm new password" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <div className="pt-2">
          <Button type="submit" disabled={changePasswordMutation.isPending}>
            {changePasswordMutation.isPending ? 'Updating...' : 'Update Password'}
          </Button>
        </div>
      </form>
    </Form>
  )
}
