import React, { useEffect, useMemo, useState } from 'react';
import {
  Modal,
  ModalDialog,
  ModalClose,
  Box,
  Button,
  Typography,
  FormControl,
  FormLabel,
  Select,
  Option,
} from '@mui/joy';
import { Show } from '../../models/Content';

export interface ShowProgressModalProps {
  // The show being edited, or null when the modal is closed.
  show: Show | null;
  onClose: () => void;
  // Save handler: season/episode when set, or (null, null) to clear.
  onSave: (id: string, season: number | null, episode: number | null) => Promise<void>;
}

// Fallback bounds when a show hasn't been TMDB-fetched yet (number_of_seasons /
// number_of_episodes are null). Generous enough for almost any real show.
const FALLBACK_SEASON_MAX = 30;
const FALLBACK_EPISODE_MAX = 60;

const rangeUpTo = (max: number): number[] => Array.from({ length: max }, (_, i) => i + 1);

// Editor for a show's household-shared episode progress (issue #107). Season and
// episode are dropdowns of valid numbers rather than free text: Season is bounded
// by the show's number_of_seasons, Episode by its number_of_episodes (series
// total — the data model has no per-season episode counts, see D-20). Any
// already-set value is always included so pre-existing progress is never dropped.
const ShowProgressModal: React.FC<ShowProgressModalProps> = ({ show, onClose, onSave }) => {
  const [season, setSeason] = useState<number | null>(null);
  const [episode, setEpisode] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  // Re-seed the inputs whenever a different show opens.
  useEffect(() => {
    setSeason(show?.next_season ?? null);
    setEpisode(show?.next_episode ?? null);
  }, [show]);

  const seasonMax = Math.max(
    show?.number_of_seasons || FALLBACK_SEASON_MAX,
    show?.next_season ?? 0,
  );
  const episodeMax = Math.max(
    show?.number_of_episodes || FALLBACK_EPISODE_MAX,
    show?.next_episode ?? 0,
  );
  const seasonOptions = useMemo(() => rangeUpTo(seasonMax), [seasonMax]);
  const episodeOptions = useMemo(() => rangeUpTo(episodeMax), [episodeMax]);

  if (!show) return null;

  const valid = season != null && episode != null;
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
            if (season != null && episode != null) runSave(season, episode);
          }}
        >
          <Box sx={{ display: 'flex', gap: 1.5 }}>
            <FormControl sx={{ flex: 1 }}>
              <FormLabel>Season</FormLabel>
              <Select
                value={season}
                placeholder="—"
                onChange={(_, v) => setSeason(v as number | null)}
                slotProps={{ listbox: { sx: { maxHeight: 260, overflow: 'auto' } } }}
              >
                {seasonOptions.map((n) => (
                  <Option key={n} value={n}>
                    {n}
                  </Option>
                ))}
              </Select>
            </FormControl>
            <FormControl sx={{ flex: 1 }}>
              <FormLabel>Episode</FormLabel>
              <Select
                value={episode}
                placeholder="—"
                onChange={(_, v) => setEpisode(v as number | null)}
                slotProps={{ listbox: { sx: { maxHeight: 260, overflow: 'auto' } } }}
              >
                {episodeOptions.map((n) => (
                  <Option key={n} value={n}>
                    {n}
                  </Option>
                ))}
              </Select>
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
