import React, { useState } from 'react';
import { useQuery, useMutation } from '@apollo/client';
import {
  Box,
  Button,
  Table,
  Sheet,
  Typography,
  Modal,
  ModalDialog,
  FormControl,
  FormLabel,
  Input,
  Checkbox,
  Alert,
  Chip,
} from '@mui/joy';
import { GET_USERS, CREATE_USER, UPDATE_USER, DELETE_USER } from '../../graphql/queries';
import { User } from '../../models/User';
import { getGravatarUrl } from '../../utils/gravatar';

export const UserManagement: React.FC = () => {
  const [open, setOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    display_name: '',
    password: '',
    is_admin: false,
    is_active: true,
  });
  const [error, setError] = useState('');

  const { data, loading, refetch } = useQuery(GET_USERS);

  const [createUser, { loading: creating }] = useMutation(CREATE_USER, {
    onCompleted: () => {
      refetch();
      handleClose();
    },
    onError: (err) => setError(err.message),
  });

  const [updateUser, { loading: updating }] = useMutation(UPDATE_USER, {
    onCompleted: () => {
      refetch();
      handleClose();
    },
    onError: (err) => setError(err.message),
  });

  const [deleteUser] = useMutation(DELETE_USER, {
    onCompleted: () => refetch(),
    onError: (err) => alert(err.message),
  });

  const handleOpen = (user?: User) => {
    if (user) {
      setEditingUser(user);
      setFormData({
        username: user.username,
        email: user.email,
        display_name: user.display_name || '',
        password: '',
        is_admin: user.is_admin,
        is_active: user.is_active,
      });
    } else {
      setEditingUser(null);
      setFormData({
        username: '',
        email: '',
        display_name: '',
        password: '',
        is_admin: false,
        is_active: true,
      });
    }
    setError('');
    setOpen(true);
  };

  const handleClose = () => {
    setOpen(false);
    setEditingUser(null);
    setFormData({
      username: '',
      email: '',
      display_name: '',
      password: '',
      is_admin: false,
      is_active: true,
    });
    setError('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    try {
      if (editingUser) {
        const variables: any = { id: editingUser.id };
        if (formData.username !== editingUser.username) variables.username = formData.username;
        if (formData.email !== editingUser.email) variables.email = formData.email;
        if (formData.display_name !== (editingUser.display_name || ''))
          variables.display_name = formData.display_name || null;
        if (formData.password) variables.password = formData.password;
        if (formData.is_admin !== editingUser.is_admin) variables.is_admin = formData.is_admin;
        if (formData.is_active !== editingUser.is_active) variables.is_active = formData.is_active;

        await updateUser({ variables });
      } else {
        if (!formData.password) {
          setError('Password is required for new users');
          return;
        }
        await createUser({
          variables: {
            ...formData,
            display_name: formData.display_name || null,
          },
        });
      }
    } catch (err) {
      // Error is handled by onError callback
    }
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('Are you sure you want to delete this user?')) {
      await deleteUser({ variables: { id } });
    }
  };

  if (loading) return <Typography>Loading...</Typography>;

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography level="h3">User Management</Typography>
        <Button onClick={() => handleOpen()}>Add User</Button>
      </Box>

      <Sheet variant="outlined" sx={{ borderRadius: 'sm', overflow: 'auto' }}>
        <Table>
          <thead>
            <tr>
              <th style={{ width: 40 }}></th>
              <th>Username</th>
              <th>Display Name</th>
              <th>Email</th>
              <th style={{ width: 70 }}>Admin</th>
              <th style={{ width: 80 }}>Status</th>
              <th style={{ width: 110 }}>Last Login</th>
              <th style={{ width: 100 }}>Created</th>
              <th style={{ width: 120 }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {data?.users.map((user: User) => (
              <tr key={user.id}>
                <td>
                  <img
                    src={getGravatarUrl(user.email, 28)}
                    alt=""
                    style={{ width: 28, height: 28, borderRadius: '50%', display: 'block' }}
                  />
                </td>
                <td>{user.username}</td>
                <td>
                  {user.display_name || (
                    <Typography level="body-xs" sx={{ color: 'text.tertiary' }}>
                      —
                    </Typography>
                  )}
                </td>
                <td>{user.email}</td>
                <td>{user.is_admin ? 'Yes' : 'No'}</td>
                <td>
                  <Chip
                    size="sm"
                    color={user.is_active ? 'success' : 'neutral'}
                    variant="soft"
                  >
                    {user.is_active ? 'Active' : 'Suspended'}
                  </Chip>
                </td>
                <td>
                  <Typography level="body-xs">
                    {user.last_login_at
                      ? new Date(user.last_login_at).toLocaleDateString()
                      : '—'}
                  </Typography>
                </td>
                <td>{new Date(user.created_at!).toLocaleDateString()}</td>
                <td>
                  <Box sx={{ display: 'flex', gap: 1 }}>
                    <Button size="sm" variant="soft" onClick={() => handleOpen(user)}>
                      Edit
                    </Button>
                    <Button
                      size="sm"
                      variant="soft"
                      color="danger"
                      onClick={() => handleDelete(user.id)}
                    >
                      Delete
                    </Button>
                  </Box>
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Sheet>

      <Modal open={open} onClose={handleClose}>
        <ModalDialog sx={{ minWidth: 400 }}>
          <Typography level="h4" sx={{ mb: 2 }}>
            {editingUser ? 'Edit User' : 'Create User'}
          </Typography>
          <form onSubmit={handleSubmit}>
            <FormControl sx={{ mb: 2 }}>
              <FormLabel>Username</FormLabel>
              <Input
                value={formData.username}
                onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                required
              />
            </FormControl>

            <FormControl sx={{ mb: 2 }}>
              <FormLabel>Display Name</FormLabel>
              <Input
                value={formData.display_name}
                onChange={(e) => setFormData({ ...formData, display_name: e.target.value })}
                placeholder="Optional — shown in place of username"
              />
            </FormControl>

            <FormControl sx={{ mb: 2 }}>
              <FormLabel>Email</FormLabel>
              <Input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                required
              />
            </FormControl>

            <FormControl sx={{ mb: 2 }}>
              <FormLabel>Password {editingUser && '(leave blank to keep current)'}</FormLabel>
              <Input
                type="password"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                required={!editingUser}
              />
            </FormControl>

            <Box sx={{ display: 'flex', gap: 3, mb: 2 }}>
              <FormControl>
                <Checkbox
                  label="Is Admin"
                  checked={formData.is_admin}
                  onChange={(e) => setFormData({ ...formData, is_admin: e.target.checked })}
                />
              </FormControl>
              <FormControl>
                <Checkbox
                  label="Active"
                  checked={formData.is_active}
                  onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                />
              </FormControl>
            </Box>

            {error && (
              <Alert color="danger" sx={{ mb: 2 }}>
                {error}
              </Alert>
            )}

            <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
              <Button variant="plain" color="neutral" onClick={handleClose}>
                Cancel
              </Button>
              <Button type="submit" loading={creating || updating}>
                {editingUser ? 'Update' : 'Create'}
              </Button>
            </Box>
          </form>
        </ModalDialog>
      </Modal>
    </Box>
  );
};
