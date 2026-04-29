import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { Snackbar, Typography, Box } from '@mui/joy';

type ToastColor = 'success' | 'danger' | 'warning' | 'neutral';

interface Toast {
  message: string;
  color: ToastColor;
  autoHideDuration: number;
}

interface ToastContextType {
  showToast: (message: string, color?: ToastColor, duration?: number) => void;
  showSuccess: (message: string) => void;
  showError: (message: string) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const ToastProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [open, setOpen] = useState(false);
  const [toast, setToast] = useState<Toast>({
    message: '',
    color: 'neutral',
    autoHideDuration: 4000,
  });

  const showToast = useCallback(
    (message: string, color: ToastColor = 'neutral', duration?: number) => {
      setToast({
        message,
        color,
        autoHideDuration: duration ?? (color === 'danger' ? 6000 : 4000),
      });
      setOpen(true);
    },
    [],
  );

  const showSuccess = useCallback((message: string) => showToast(message, 'success'), [showToast]);
  const showError = useCallback((message: string) => showToast(message, 'danger'), [showToast]);

  return (
    <ToastContext.Provider value={{ showToast, showSuccess, showError }}>
      {children}
      <Snackbar
        open={open}
        onClose={() => setOpen(false)}
        autoHideDuration={toast.autoHideDuration}
        color={toast.color}
        variant="soft"
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        sx={{ minWidth: 240, maxWidth: 420 }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Typography level="body-sm" sx={{ fontWeight: 600 }}>
            {toast.message}
          </Typography>
        </Box>
      </Snackbar>
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const context = useContext(ToastContext);
  if (context === undefined) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};
