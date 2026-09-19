import React, { useEffect, useState } from 'react';
import {
  Modal,
  ModalDialog,
  ModalClose,
  Box,
  Button,
  Typography,
  FormControl,
  FormLabel,
  Input,
} from '@mui/joy';
import { Show } from '../../models/Content';

export interface ShowProgressModalProps {
  // The show being edited, or null when the modal is closed.
  show: Show | null;
  onClose: () => void;
  // Save handler: season/episode when set, or (null, null) to clear.
  onSave: (id: string, season: number | null, episode: number | null) => Promise<void>;
}

// Editor for a show's household-shared episode progress (issue #107). Two number
// inputs pre-filled from the show's current next_season/next_episode, a Save that
// records "we're on SxEy", and a Clear that removes progress entirely.
const ShowProgressModal: React.FC<ShowProgressModalProps> = ({ show, onClose, onSave }) => {
  const [season, setSeason] = useState('');
  const [episode, setEpisode] = useState('');
  const [saving, setSaving] = useState(false);

  // Re-seed the inputs whenever a different show opens.
  useEffect(() => {
    setSeason(show?.next_season != null ? String(show.next_season) : '');
    setEpisode(show?.next_episode != null ? String(show.next_episode) : '');
  }, [show]);

  if (!show) return null;

  const seasonNum = Number(season);
  const episodeNum = Number(episode);
  const bothFilled = season.trim() !== '' && episode.trim() !== '';
  const valid =
    bothFilled &&
    Number.isInteger(seasonNum) &&
    seasonNum >= 1 &&
    Number.isInteger(episodeNum) &&
    episodeNum >= 1;
  const hasExisting = show.next_season != null && show.next_episode != null;

  const runSave = async (nextSeason: number | null, nextEpisode: number | null) => {
    setSaving(true);
    try {
      await onSave(show.id, nextSeason, nextEpisode);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={!!show} onClose={saving ? undefined : onClose}>
      <ModalDialog sx={{ maxWidth: 360, width: '100%' }}>
        <ModalClose disabled={saving} />
        <Typography level="title-lg" sx={{ fontWeight: 700 }}>
          Episode progress
        </Typography>
        <Typography level="body-sm" sx={{ color: 'text.secondary', mb: 1 }}>
          Where are you up to on <strong>{show.title}</strong>? Shared with everyone.
        </Typography>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (valid) runSave(seasonNum, episodeNum);
          }}
        >
          <Box sx={{ display: 'flex', gap: 1.5 }}>
            <FormControl sx={{ flex: 1 }}>
              <FormLabel>Season</FormLabel>
              <Input
                type="number"
                slotProps={{ input: { min: 1, step: 1, inputMode: 'numeric' } }}
                value={season}
                autoFocus
                onChange={(e) => setSeason(e.target.value)}
                placeholder="2"
              />
            </FormControl>
            <FormControl sx={{ flex: 1 }}>
              <FormLabel>Episode</FormLabel>
              <Input
                type="number"
                slotProps={{ input: { min: 1, step: 1, inputMode: 'numeric' } }}
                value={episode}
                onChange={(e) => setEpisode(e.target.value)}
                placeholder="4"
              />
            </FormControl>
          </Box>

          <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 1, mt: 2.5 }}>
            <Button
              variant="plain"
              color="danger"
              disabled={saving || !hasExisting}
              onClick={() => runSave(null, null)}
            >
              Clear
            </Button>
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Button variant="plain" color="neutral" disabled={saving} onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit" loading={saving} disabled={!valid}>
                Save
              </Button>
            </Box>
          </Box>
        </form>
      </ModalDialog>
    </Modal>
  );
};

export default ShowProgressModal;
