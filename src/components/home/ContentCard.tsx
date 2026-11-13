import React from 'react';
import { Box, Typography, IconButton, Tooltip } from '@mui/joy';
import { Check, ExternalLink, Eye, EyeOff, X } from 'lucide-react';
import { ContentItem, ContentKind, Show } from '../../models/Content';
import { tmdbUrl } from '../../utils/tmdb';
import { KindChip, showMetaLine, EpisodeProgressControl, RankNumeral } from './kindAffordance';
import Poster from '../common/Poster';

export interface ContentCardProps {
  item: ContentItem;
  kind: ContentKind;
  rank?: number;
  isAdmin: boolean;
  canMarkWatched: boolean;
  onMarkWatched: (id: string, title: string) => void;
  onDelete: (id: string, title: string) => void;
  onToggleSeen: (id: string, currentlySeen: boolean) => void;
  // Shows only: open the episode-progress editor. Omitted for movies.
  onEditProgress?: (show: Show) => void;
  isAuthenticated: boolean;
  isRecentlyAdded?: boolean;
}

// Phone layout of a queue entry: the same ledger as ContentRow, restacked.
// Rank, poster and title on one line; meta, then the actions at a 44px hit
// target, under the title.
const ContentCard: React.FC<ContentCardProps> = ({
  item,
  kind,
  rank,
  isAdmin,
  canMarkWatched,
  onMarkWatched,
  onDelete,
  onToggleSeen,
  onEditProgress,
  isAuthenticated,
  isRecentlyAdded = false,
}) => {
  const show = kind === 'show' ? (item as Show) : null;
  const meta = show ? showMetaLine(show) : '';
  const progress = show?.episode_progress ?? null;
  const canEditProgress = !!show && isAuthenticated && !!onEditProgress;
  const isSeen = item.myTags?.some((t) => t.tag.slug === 'seen') ?? false;
  const seenByUsers = (item.userTags ?? []).filter((t) => t.tag.slug === 'seen');
  const seenCount = seenByUsers.length;
  const seenNames = seenByUsers.map((t) => t.user.display_name || t.user.username);

  const hit = { minWidth: 44, minHeight: 44 };

  return (
    <Box
      sx={{
        display: 'flex',
        gap: 1.5,
        py: 1.5,
        px: isRecentlyAdded ? 1 : 0,
        borderBottom: '1px solid var(--color-rule)',
        bgcolor: isRecentlyAdded
          ? 'rgba(var(--joy-palette-primary-mainChannel) / 0.07)'
          : undefined,
      }}
    >
      {rank != null && (
        <Box sx={{ pt: 0.25, flexShrink: 0 }}>
          <RankNumeral rank={rank} kind={kind} size="md" />
        </Box>
      )}
      <Poster url={item.poster_url} size="sm" />

      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography level="title-md" sx={{ fontWeight: 600, lineHeight: 1.3 }}>
          {item.title}
        </Typography>
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            columnGap: 1.25,
            rowGap: 0.25,
            mt: 0.5,
            flexWrap: 'wrap',
          }}
        >
          <KindChip kind={kind} />
          <Typography level="body-xs" sx={{ color: 'text.secondary' }}>
            {item.requester}
          </Typography>
          <Typography level="body-xs" sx={{ color: 'text.tertiary' }}>
            {new Date(item.date_submitted).toLocaleDateString(undefined, {
              month: 'short',
              day: 'numeric',
            })}
          </Typography>
        </Box>
        {show && (meta || progress || canEditProgress) && (
          <Box
            sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mt: 0.25, flexWrap: 'wrap' }}
          >
            {meta && (
              <Typography level="body-xs" sx={{ color: 'text.tertiary' }}>
                {meta}
              </Typography>
            )}
            <EpisodeProgressControl
              title={item.title}
              value={progress}
              onEdit={canEditProgress ? () => onEditProgress!(show) : undefined}
              touch
            />
          </Box>
        )}
        <Box sx={{ display: 'flex', alignItems: 'center', mt: 0.5, ml: -1.25 }}>
          {item.tmdb_id && (
            <IconButton
              component="a"
              href={tmdbUrl(kind, item.tmdb_id)}
              target="_blank"
              rel="noopener noreferrer"
              size="sm"
              variant="plain"
              color="neutral"
              aria-label={`View ${item.title} on TMDB (opens in new tab)`}
              sx={hit}
            >
              <ExternalLink size={16} strokeWidth={2} />
            </IconButton>
          )}
          {isAuthenticated && (
            <Tooltip
              title={
                seenCount > 0
                  ? `Seen by: ${seenNames.join(', ')}`
                  : isSeen
                    ? 'Remove “Seen it”'
                    : 'I’ve seen this'
              }
              arrow
            >
              <IconButton
                size="sm"
                variant={isSeen ? 'soft' : 'plain'}
                color={isSeen ? 'warning' : 'neutral'}
                onClick={() => onToggleSeen(item.id, isSeen)}
                aria-label={
                  isSeen ? `Remove "Seen it" from ${item.title}` : `Mark ${item.title} as seen`
                }
                aria-pressed={isSeen}
                sx={hit}
              >
                {isSeen ? (
                  <Eye size={16} strokeWidth={2.25} />
                ) : (
                  <EyeOff size={16} strokeWidth={2.25} />
                )}
                {seenCount > 0 && (
                  <Typography component="span" level="body-xs" sx={{ ml: 0.25, fontWeight: 600 }}>
                    {seenCount}
                  </Typography>
                )}
              </IconButton>
            </Tooltip>
          )}
          {canMarkWatched && (
            <IconButton
              size="sm"
              color="success"
              variant="plain"
              onClick={() => onMarkWatched(item.id, item.title)}
              aria-label={`Mark "${item.title}" as done`}
              sx={hit}
            >
              <Check size={18} strokeWidth={2.5} />
            </IconButton>
          )}
          {isAdmin && (
            <IconButton
              size="sm"
              color="danger"
              variant="plain"
              onClick={() => onDelete(item.id, item.title)}
              aria-label={`Remove "${item.title}"`}
              sx={hit}
            >
              <X size={18} strokeWidth={2.5} />
            </IconButton>
          )}
        </Box>
      </Box>
    </Box>
  );
};

export default ContentCard;
