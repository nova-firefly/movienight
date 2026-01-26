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
  IconButton,
} from '@mui/joy';
import { GET_USERS, CREATE_USER, UPDATE_USER, DELETE_USER } from '../../graphql/queries';
import { User } from '../../models/User';

export const UserManagement: React.FC = () => {
  const [open, setOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    is_admin: false,
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
        password: '',
        is_admin: user.is_admin,
      });
    } else {
      setEditingUser(null);
      setFormData({
        username: '',
        email: '',
        password: '',
        is_admin: false,
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
      password: '',
      is_admin: false,
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
        if (formData.password) variables.password = formData.password;
        if (formData.is_admin !== editingUser.is_admin) variables.is_admin = formData.is_admin;

        await updateUser({ variables });
      } else {
        if (!formData.password) {
          setError('Password is required for new users');
          return;
        }
        await createUser({ variables: formData });
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
              <th>Username</th>
              <th>Email</th>
              <th>Admin</th>
              <th>Created</th>
              <th style={{ width: 120 }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {data?.users.map((user: User) => (
              <tr key={user.id}>
                <td>{user.username}</td>
                <td>{user.email}</td>
                <td>{user.is_admin ? 'Yes' : 'No'}</td>
                <td>{new Date(user.created_at!).toLocaleDateString()}</td>
                <td>
                  <Box sx={{ display: 'flex', gap: 1 }}>
                    <Button size="sm" variant="soft" onClick={() => handleOpen(user)}>
                      Edit
                    </Button>
                    <Button size="sm" variant="soft" color="danger" onClick={() => handleDelete(user.id)}>
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
        <ModalDialog>
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

            <FormControl sx={{ mb: 2 }}>
              <Checkbox
                label="Is Admin"
                checked={formData.is_admin}
                onChange={(e) => setFormData({ ...formData, is_admin: e.target.checked })}
              />
            </FormControl>

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
