import React from 'react';
import { Modal, ModalDialog, Typography, Button, Box, Divider } from '@mui/joy';

export interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  confirmColor?: 'danger' | 'primary' | 'warning' | 'success';
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  open,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  confirmColor = 'primary',
  loading = false,
  onConfirm,
  onCancel,
}) => (
  <Modal open={open} onClose={onCancel}>
    <ModalDialog
      sx={{
        maxWidth: 400,
        width: '100%',
        p: 3,
        bgcolor: 'background.level1',
        borderColor: 'var(--mn-border-vis)',
      }}
    >
      <Typography level="title-md" sx={{ fontWeight: 700, mb: 0.5 }}>
        {title}
      </Typography>
      <Typography level="body-sm" sx={{ color: 'text.secondary', mb: 2 }}>
        {message}
      </Typography>
      <Divider sx={{ mb: 2 }} />
      <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
        <Button variant="plain" color="neutral" onClick={onCancel} disabled={loading}>
          {cancelText}
        </Button>
        <Button
          variant="solid"
          color={confirmColor}
          onClick={onConfirm}
          loading={loading}
          sx={{
            fontWeight: 700,
            ...(confirmColor === 'primary' ? { color: '#0d0f1a' } : {}),
          }}
        >
          {confirmText}
        </Button>
      </Box>
    </ModalDialog>
  </Modal>
);

export default ConfirmDialog;
