import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { Plus, Users, Edit, Trash2, MoreVertical } from 'lucide-react'

import { ProtectedRoute } from '#/shared/components/ProtectedRoute'
import { AppLayout } from '#/shared/components/AppLayout'
import {
  useAdminUsers,
  useAdminCreateUser,
  useAdminSetUserStatus,
  useAdminUpdateUser,
  useAdminDeleteUser,
} from '#/app/admin/users/api/users.queries'
import type { User } from '#/shared/types/api'
import { Button } from '#/components/ui/button'
import { Input } from '#/components/ui/input'
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
  DialogHeader,
  DialogTitle,
} from '#/components/ui/dialog'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '#/components/ui/form'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '#/components/ui/dropdown-menu'
import { TableSkeleton } from '#/shared/components/LoadingSkeleton'
import { ErrorMessage, EmptyState } from '#/shared/components/ErrorMessage'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '#/components/ui/select'
import { cn } from '#/lib/utils'
import { useAuth } from '#/shared/hooks/useAuth'

export const Route = createFileRoute('/admin/users/')({
  component: AdminUsersPage,
})

const baseUserSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  mobileNumber: z.string().min(7, 'Mobile number must be at least 7 digits'),
  role: z.enum(['admin', 'user']),
})

const userSchema = baseUserSchema.extend({
  password: z.string().min(8, 'Password must be at least 8 characters'),
})

const updateUserSchema = baseUserSchema.extend({
  password: z
    .string()
    .optional()
    .refine((val) => !val || val.length >= 8, {
      message: 'Password must be at least 8 characters if provided',
    }),
})

type UserForm = z.infer<typeof userSchema>
type UpdateUserForm = z.infer<typeof updateUserSchema>

function AdminUsersPage() {
  const { user } = useAuth()

  if (user?.role !== 'admin') {
    return (
      <ProtectedRoute>
        <AppLayout>
          <div className="flex items-center justify-center h-[50vh]">
            <ErrorMessage message="Unauthorized Access. Admin only." />
          </div>
        </AppLayout>
      </ProtectedRoute>
    )
  }

  return (
    <ProtectedRoute>
      <AppLayout>
        <AdminUsersContent />
      </AppLayout>
    </ProtectedRoute>
  )
}

function AdminUsersContent() {
  const [page, setPage] = useState(1)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingUser, setEditingUser] = useState<User | null>(null)

  const { data, isLoading, isError, refetch } = useAdminUsers(page)
  const setStatus = useAdminSetUserStatus()
  const createUser = useAdminCreateUser()
  const updateUser = useAdminUpdateUser(editingUser?.id ?? '')
  const deleteUser = useAdminDeleteUser()

  const form = useForm<UpdateUserForm>({
    resolver: zodResolver(editingUser ? updateUserSchema : userSchema),
    defaultValues: {
      name: '',
      mobileNumber: '',
      password: '',
      role: 'user',
    },
  })

  const handleOpenCreate = () => {
    setEditingUser(null)
    form.reset({ name: '', mobileNumber: '', password: '', role: 'user' })
    setIsModalOpen(true)
  }

  const handleOpenEdit = (user: User) => {
    setEditingUser(user)
    form.reset({
      name: user.name,
      mobileNumber: user.mobileNumber,
      password: '',
      role: user.role,
    })
    setIsModalOpen(true)
  }

  const handleDelete = async (id: string) => {
    if (window.confirm('Are you sure you want to delete this user?')) {
      try {
        await deleteUser.mutateAsync(id)
        toast.success('User deleted successfully')
      } catch {
        toast.error('Failed to delete user')
      }
    }
  }

  async function onSubmit(values: UpdateUserForm) {
    try {
      if (editingUser) {
        const payload = { ...values }
        if (!payload.password) delete payload.password

        await updateUser.mutateAsync(payload)
        toast.success('User updated successfully')
      } else {
        await createUser.mutateAsync(values as UserForm)
        toast.success('User created successfully')
      }
      setIsModalOpen(false)
      form.reset()
      setEditingUser(null)
    } catch {
      toast.error(`Failed to ${editingUser ? 'update' : 'create'} user`)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Manage Users</h1>
        </div>

        <Button onClick={handleOpenCreate}>
          <Plus className="h-4 w-4 mr-2" />
          Add User
        </Button>

        <Dialog
          open={isModalOpen}
          onOpenChange={(open) => {
            setIsModalOpen(open)
            if (!open) {
              setTimeout(() => {
                setEditingUser(null)
                form.reset({
                  name: '',
                  mobileNumber: '',
                  password: '',
                  role: 'user',
                })
              }, 200)
            }
          }}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {editingUser ? 'Edit User' : 'Create New User'}
              </DialogTitle>
              <DialogDescription>
                {editingUser
                  ? 'Update the user details below.'
                  : 'Add a new user to the system. They will be able to log in with their mobile number and password.'}
              </DialogDescription>
            </DialogHeader>
            <Form {...form}>
              <form
                onSubmit={form.handleSubmit(onSubmit)}
                className="space-y-4"
              >
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Full Name</FormLabel>
                      <FormControl>
                        <Input placeholder="John Doe" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="mobileNumber"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Mobile Number</FormLabel>
                      <FormControl>
                        <Input placeholder="98XXXXXXXX" {...field} />
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
                      <FormLabel>
                        Password{' '}
                        {editingUser && (
                          <span className="text-muted-foreground text-xs font-normal">
                            (Leave blank to keep current)
                          </span>
                        )}
                      </FormLabel>
                      <FormControl>
                        <Input
                          type="text"
                          placeholder={
                            editingUser
                              ? 'Leave blank to keep unchanged'
                              : 'Minimum 8 characters'
                          }
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="role"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Role</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                        value={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select a role" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="user">User</SelectItem>
                          <SelectItem value="admin">Admin</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="flex justify-end pt-4 gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsModalOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={createUser.isPending || updateUser.isPending}
                  >
                    {createUser.isPending || updateUser.isPending
                      ? 'Saving...'
                      : editingUser
                        ? 'Save Changes'
                        : 'Create User'}
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {data
              ? `${data.total} User${data.total !== 1 ? 's' : ''}`
              : 'System Users'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <TableSkeleton />
          ) : isError ? (
            <ErrorMessage
              message="Failed to load users"
              onRetry={() => void refetch()}
            />
          ) : !data || data.data.length === 0 ? (
            <EmptyState
              icon={<Users className="h-12 w-12" />}
              title="No users found"
              description="Create a new user to get started."
            />
          ) : (
            <>
              <div className="hidden md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Mobile Number</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Active Status</TableHead>
                      <TableHead>Joined</TableHead>
                      <TableHead className="w-[80px] text-right">
                        Actions
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.data.map((user) => (
                      <TableRow key={user.id}>
                        <TableCell className="font-medium">
                          {user.name}
                        </TableCell>
                        <TableCell>{user.mobileNumber}</TableCell>
                        <TableCell>
                          <span
                            className={cn(
                              'inline-flex items-center rounded-full px-2 py-1 text-xs font-medium',
                              user.role === 'admin'
                                ? 'bg-primary/10 text-primary'
                                : 'bg-muted text-muted-foreground',
                            )}
                          >
                            {user.role}
                          </span>
                        </TableCell>
                        <TableCell>
                          <Switch
                            checked={user.isActive}
                            onCheckedChange={(checked) =>
                              setStatus.mutate({
                                id: user.id,
                                isActive: checked,
                              })
                            }
                            disabled={setStatus.isPending}
                          />
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {new Date(user.createdAt).toLocaleDateString()}
                        </TableCell>
                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" className="h-8 w-8 p-0">
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem
                                onClick={() => handleOpenEdit(user)}
                              >
                                <Edit className="h-4 w-4 mr-2" /> Edit
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                className="text-destructive focus:text-destructive"
                                onClick={() => handleDelete(user.id)}
                              >
                                <Trash2 className="h-4 w-4 mr-2" /> Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Mobile Card View */}
              <div className="md:hidden grid gap-4">
                {data.data.map((user) => (
                  <Card key={user.id}>
                    <CardContent className="p-4 space-y-3">
                      <div className="flex items-center justify-between border-b pb-3">
                        <div className="font-semibold text-lg flex items-center gap-2">
                          {user.name}
                          <span
                            className={cn(
                              'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
                              user.role === 'admin'
                                ? 'bg-primary/10 text-primary'
                                : 'bg-muted text-muted-foreground',
                            )}
                          >
                            {user.role}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={user.isActive}
                            onCheckedChange={(checked) =>
                              setStatus.mutate({
                                id: user.id,
                                isActive: checked,
                              })
                            }
                            disabled={setStatus.isPending}
                          />
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                className="h-8 w-8 p-0 ml-1"
                              >
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem
                                onClick={() => handleOpenEdit(user)}
                              >
                                <Edit className="h-4 w-4 mr-2" /> Edit
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                className="text-destructive focus:text-destructive"
                                onClick={() => handleDelete(user.id)}
                              >
                                <Trash2 className="h-4 w-4 mr-2" /> Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div className="text-muted-foreground">Mobile</div>
                        <div className="font-medium text-right">
                          {user.mobileNumber}
                        </div>
                        <div className="text-muted-foreground">Joined</div>
                        <div className="font-medium text-right">
                          {new Date(user.createdAt).toLocaleDateString()}
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
    </div>
  )
}
