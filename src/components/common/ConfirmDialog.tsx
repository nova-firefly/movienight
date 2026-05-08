import React from 'react';
import { Modal, ModalDialog, Typography, Button, Box, Divider } from '@mui/joy';

export type ConfirmColor = 'danger' | 'primary' | 'warning' | 'success';

export interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  confirmColor?: ConfirmColor;
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

const ICONS: Record<ConfirmColor, string> = {
  danger: '⚠',
  warning: '⚠',
  success: '✓',
  primary: 'ⓘ',
};

const ICON_BG: Record<ConfirmColor, string> = {
  danger: 'rgba(224, 64, 64, 0.15)',
  warning: 'rgba(245, 166, 35, 0.15)',
  success: 'rgba(76, 175, 130, 0.15)',
  primary: 'rgba(245, 197, 24, 0.15)',
};

const ICON_COLOR: Record<ConfirmColor, string> = {
  danger: '#ef9a9a',
  warning: '#fbc45a',
  success: '#80cfa9',
  primary: '#ffd133',
};

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
}) => {
  const isDestructive = confirmColor === 'danger' || confirmColor === 'warning';
  return (
    <Modal open={open} onClose={onCancel}>
      <ModalDialog
        role="alertdialog"
        aria-labelledby="confirm-dialog-title"
        aria-describedby="confirm-dialog-message"
        sx={{
          maxWidth: 400,
          width: '100%',
          p: 3,
          bgcolor: 'background.level1',
          borderColor: 'var(--mn-border-vis)',
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5, mb: 0.5 }}>
          {isDestructive && (
            <Box
              aria-hidden="true"
              sx={{
                width: 32,
                height: 32,
                borderRadius: '50%',
                bgcolor: ICON_BG[confirmColor],
                color: ICON_COLOR[confirmColor],
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '1rem',
                fontWeight: 700,
                flexShrink: 0,
              }}
            >
              {ICONS[confirmColor]}
            </Box>
          )}
          <Typography
            id="confirm-dialog-title"
            level="title-md"
            sx={{ fontWeight: 700, pt: isDestructive ? 0.5 : 0 }}
          >
            {title}
          </Typography>
        </Box>
        <Typography
          id="confirm-dialog-message"
          level="body-sm"
          sx={{ color: 'text.secondary', mb: 2, ml: isDestructive ? 5.5 : 0 }}
        >
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
};

export default ConfirmDialog;
