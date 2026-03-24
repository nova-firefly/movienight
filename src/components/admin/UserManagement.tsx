import React, { useState } from 'react';
import { useQuery, useMutation } from '@apollo/client';
import {
  Box,
  Button,
  CircularProgress,
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
  IconButton,
  Divider,
} from '@mui/joy';
import { GET_USERS, CREATE_USER, UPDATE_USER, DELETE_USER } from '../../graphql/queries';
import { User } from '../../models/User';
import { getGravatarUrl } from '../../utils/gravatar';

const thStyle: React.CSSProperties = {
  padding: '10px 16px',
  textAlign: 'left',
  fontSize: '0.7rem',
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
  color: 'var(--mn-text-muted)',
  background: 'var(--mn-bg-elevated)',
  borderBottom: '1px solid var(--mn-border-vis)',
  whiteSpace: 'nowrap',
};

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
    onCompleted: () => { refetch(); handleClose(); },
    onError: (err) => setError(err.message),
  });

  const [updateUser, { loading: updating }] = useMutation(UPDATE_USER, {
    onCompleted: () => { refetch(); handleClose(); },
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
      setFormData({ username: '', email: '', display_name: '', password: '', is_admin: false, is_active: true });
    }
    setError('');
    setOpen(true);
  };

  const handleClose = () => {
    setOpen(false);
    setEditingUser(null);
    setFormData({ username: '', email: '', display_name: '', password: '', is_admin: false, is_active: true });
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
        if (!formData.password) { setError('Password is required for new users'); return; }
        await createUser({ variables: { ...formData, display_name: formData.display_name || null } });
      }
    } catch {
      // handled by onError
    }
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('Delete this user?')) {
      await deleteUser({ variables: { id } });
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
        <CircularProgress size="md" color="primary" />
      </Box>
    );
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography level="title-md" fontWeight={700} sx={{ color: 'text.secondary' }}>
          {data?.users?.length ?? 0} user{data?.users?.length !== 1 ? 's' : ''}
        </Typography>
        <Button
          color="primary"
          variant="solid"
          size="sm"
          onClick={() => handleOpen()}
          sx={{ fontWeight: 700, color: '#0d0f1a' }}
        >
          + Add User
        </Button>
      </Box>

      <Sheet
        variant="outlined"
        sx={{ borderRadius: 'md', overflow: 'hidden', borderColor: 'var(--mn-border-vis)' }}
      >
        <Box sx={{ overflowX: 'auto' }}>
          <Table
            stickyHeader
            sx={{
              '--TableCell-headBackground': 'var(--mn-bg-elevated)',
              '--TableRow-hoverBackground': 'var(--mn-bg-hover)',
              '--TableCell-paddingY': '12px',
              '--TableCell-paddingX': '16px',
              minWidth: 720,
            }}
          >
            <thead>
              <tr>
                <th style={{ ...thStyle, width: 44 }} />
                <th style={thStyle}>Username</th>
                <th style={thStyle}>Display Name</th>
                <th style={thStyle}>Email</th>
                <th style={{ ...thStyle, width: 70 }}>Admin</th>
                <th style={{ ...thStyle, width: 100 }}>Status</th>
                <th style={{ ...thStyle, width: 110 }}>Last Login</th>
                <th style={{ ...thStyle, width: 100 }}>Created</th>
                <th style={{ ...thStyle, width: 110, textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {data?.users.map((user: User) => (
                <tr key={user.id}>
                  <td style={{ paddingLeft: 16 }}>
                    <img
                      src={getGravatarUrl(user.email, 28)}
                      alt=""
                      style={{
                        width: 28,
                        height: 28,
                        borderRadius: '50%',
                        display: 'block',
                        border: '2px solid rgba(245,197,24,0.2)',
                      }}
                    />
                  </td>
                  <td>
                    <Typography level="body-sm" fontWeight={600}>
                      {user.username}
                    </Typography>
                  </td>
                  <td>
                    {user.display_name ? (
                      <Typography level="body-sm">{user.display_name}</Typography>
                    ) : (
                      <Typography level="body-xs" sx={{ color: 'text.tertiary' }}>—</Typography>
                    )}
                  </td>
                  <td>
                    <Typography level="body-xs" sx={{ color: 'text.secondary' }}>{user.email}</Typography>
                  </td>
                  <td>
                    {user.is_admin && (
                      <Chip size="sm" color="warning" variant="soft">Admin</Chip>
                    )}
                  </td>
                  <td>
                    <Chip size="sm" color={user.is_active ? 'success' : 'neutral'} variant="soft">
                      {user.is_active ? 'Active' : 'Suspended'}
                    </Chip>
                  </td>
                  <td>
                    <Typography level="body-xs" sx={{ color: 'text.secondary' }}>
                      {user.last_login_at
                        ? new Date(user.last_login_at).toLocaleDateString()
                        : '—'}
                    </Typography>
                  </td>
                  <td>
                    <Typography level="body-xs" sx={{ color: 'text.secondary' }}>
                      {new Date(user.created_at!).toLocaleDateString()}
                    </Typography>
                  </td>
                  <td>
                    <Box sx={{ display: 'flex', gap: 0.5, justifyContent: 'flex-end', pr: 1 }}>
                      <Button size="sm" variant="soft" color="neutral" onClick={() => handleOpen(user)}>
                        Edit
                      </Button>
                      <IconButton
                        size="sm"
                        variant="plain"
                        color="danger"
                        onClick={() => handleDelete(user.id)}
                        sx={{ opacity: 0.5, '&:hover': { opacity: 1 } }}
                      >
                        ✕
                      </IconButton>
                    </Box>
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Box>
      </Sheet>

      <Modal open={open} onClose={handleClose}>
        <ModalDialog
          sx={{
            minWidth: 420,
            maxWidth: '95vw',
            bgcolor: 'background.level1',
            borderColor: 'var(--mn-border-vis)',
          }}
        >
          <Typography level="title-lg" fontWeight={700} sx={{ mb: 0.5 }}>
            {editingUser ? 'Edit User' : 'Create User'}
          </Typography>
          <Divider sx={{ mb: 2 }} />
          <form onSubmit={handleSubmit}>
            <FormControl sx={{ mb: 2 }}>
              <FormLabel sx={{ fontSize: '0.8rem', fontWeight: 600, color: 'text.secondary' }}>
                Username
              </FormLabel>
              <Input
                value={formData.username}
                onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                required
                sx={{ bgcolor: 'background.surface' }}
              />
            </FormControl>

            <FormControl sx={{ mb: 2 }}>
              <FormLabel sx={{ fontSize: '0.8rem', fontWeight: 600, color: 'text.secondary' }}>
                Display Name
              </FormLabel>
              <Input
                value={formData.display_name}
                onChange={(e) => setFormData({ ...formData, display_name: e.target.value })}
                placeholder="Optional"
                sx={{ bgcolor: 'background.surface' }}
              />
            </FormControl>

            <FormControl sx={{ mb: 2 }}>
              <FormLabel sx={{ fontSize: '0.8rem', fontWeight: 600, color: 'text.secondary' }}>
                Email
              </FormLabel>
              <Input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                required
                sx={{ bgcolor: 'background.surface' }}
              />
            </FormControl>

            <FormControl sx={{ mb: 2 }}>
              <FormLabel sx={{ fontSize: '0.8rem', fontWeight: 600, color: 'text.secondary' }}>
                Password {editingUser && <span style={{ fontWeight: 400, opacity: 0.6 }}>(leave blank to keep)</span>}
              </FormLabel>
              <Input
                type="password"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                required={!editingUser}
                sx={{ bgcolor: 'background.surface' }}
              />
            </FormControl>

            <Box sx={{ display: 'flex', gap: 3, mb: 3 }}>
              <Checkbox
                label="Is Admin"
                checked={formData.is_admin}
                onChange={(e) => setFormData({ ...formData, is_admin: e.target.checked })}
              />
              <Checkbox
                label="Active"
                checked={formData.is_active}
                onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
              />
            </Box>

            {error && (
              <Alert color="danger" variant="soft" sx={{ mb: 2 }}>
                {error}
              </Alert>
            )}

            <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
              <Button variant="plain" color="neutral" onClick={handleClose}>
                Cancel
              </Button>
              <Button
                type="submit"
                loading={creating || updating}
                color="primary"
                sx={{ fontWeight: 700, color: '#0d0f1a' }}
              >
                {editingUser ? 'Update' : 'Create'}
              </Button>
            </Box>
          </form>
        </ModalDialog>
      </Modal>
    </Box>
  );
};
