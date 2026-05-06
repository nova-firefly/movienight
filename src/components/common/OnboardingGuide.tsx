import React from 'react';
import {
  Box,
  Button,
  Divider,
  IconButton,
  Modal,
  ModalClose,
  ModalDialog,
  Sheet,
  Typography,
} from '@mui/joy';

export const ONBOARDING_DISMISSED_KEY = 'onboarding_dismissed';

interface Step {
  emoji: string;
  title: string;
  description: string;
}

const STEPS: Step[] = [
  {
    emoji: '🎬',
    title: 'Suggest',
    description: 'Add movies you want to watch.',
  },
  {
    emoji: '🤝',
    title: 'Connect',
    description: "Link up with friends. They'll see your picks and you'll see theirs.",
  },
  {
    emoji: '⚖️',
    title: 'Rank',
    description: 'Compare movies in This or That to build your preference list.',
  },
  {
    emoji: '🍿',
    title: 'Watch',
    description: 'The top-ranked movie you both agree on wins.',
  },
];

const StepList: React.FC = () => (
  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
    {STEPS.map((s, i) => (
      <Box key={s.title} sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5 }}>
        <Box
          sx={{
            fontSize: '1.5rem',
            lineHeight: 1.2,
            flexShrink: 0,
            width: 28,
            textAlign: 'center',
          }}
          aria-hidden
        >
          {s.emoji}
        </Box>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography level="title-sm" sx={{ fontWeight: 700 }}>
            {i + 1}. {s.title}
          </Typography>
          <Typography level="body-sm" sx={{ color: 'text.secondary' }}>
            {s.description}
          </Typography>
        </Box>
      </Box>
    ))}
  </Box>
);

const ExtraTips: React.FC = () => (
  <Box>
    <Typography
      level="body-xs"
      sx={{
        textTransform: 'uppercase',
        letterSpacing: '0.08em',
        fontWeight: 700,
        color: 'text.tertiary',
        mb: 1,
      }}
    >
      A few extras
    </Typography>
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
      <Typography level="body-sm" sx={{ color: 'text.secondary' }}>
        <Typography component="span" sx={{ fontWeight: 700 }}>
          Watch Alone
        </Typography>{' '}
        — movies your connections passed on, all yours to enjoy solo.
      </Typography>
      <Typography level="body-sm" sx={{ color: 'text.secondary' }}>
        <Typography component="span" sx={{ fontWeight: 700 }}>
          History
        </Typography>{' '}
        — everything you've already watched.
      </Typography>
      <Typography level="body-sm" sx={{ color: 'text.secondary' }}>
        Tap the{' '}
        <Typography component="span" sx={{ fontWeight: 700 }}>
          ?
        </Typography>{' '}
        in the header any time to revisit this.
      </Typography>
    </Box>
  </Box>
);

interface OnboardingCardProps {
  onDismiss: () => void;
}

export const OnboardingCard: React.FC<OnboardingCardProps> = ({ onDismiss }) => (
  <Sheet
    variant="outlined"
    sx={{
      mb: 3,
      p: { xs: 2, sm: 2.5 },
      borderRadius: 'md',
      bgcolor: 'primary.softBg',
      borderColor: 'primary.outlinedBorder',
      position: 'relative',
    }}
  >
    <IconButton
      variant="plain"
      color="neutral"
      size="sm"
      aria-label="Dismiss welcome card"
      onClick={onDismiss}
      sx={{
        position: 'absolute',
        top: 6,
        right: 6,
        opacity: 0.5,
        '&:hover': { opacity: 1 },
      }}
    >
      ✕
    </IconButton>
    <Typography
      level="title-md"
      sx={{ fontWeight: 800, mb: 0.5, color: 'primary.softColor', pr: 4 }}
    >
      Welcome to MovieNight
    </Typography>
    <Typography level="body-sm" sx={{ color: 'text.secondary', mb: 2 }}>
      Here's how it works:
    </Typography>
    <StepList />
    <Box sx={{ mt: 2.5, display: 'flex', justifyContent: 'flex-end' }}>
      <Button
        variant="solid"
        color="primary"
        size="sm"
        onClick={onDismiss}
        sx={{ fontWeight: 700, color: '#0d0f1a' }}
      >
        Got it
      </Button>
    </Box>
  </Sheet>
);

interface OnboardingModalProps {
  open: boolean;
  onClose: () => void;
}

export const OnboardingModal: React.FC<OnboardingModalProps> = ({ open, onClose }) => (
  <Modal open={open} onClose={onClose}>
    <ModalDialog
      sx={{
        maxWidth: 460,
        width: '100%',
        p: 3,
        bgcolor: 'background.level1',
        borderColor: 'var(--mn-border-vis)',
      }}
    >
      <ModalClose />
      <Typography level="title-lg" sx={{ fontWeight: 800, mb: 0.5 }}>
        How MovieNight works
      </Typography>
      <Typography level="body-sm" sx={{ color: 'text.secondary', mb: 2 }}>
        The four-step loop:
      </Typography>
      <StepList />
      <Divider sx={{ my: 2.5 }} />
      <ExtraTips />
    </ModalDialog>
  </Modal>
);
