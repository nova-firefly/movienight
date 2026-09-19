import React from 'react';
import { Box, Typography, Chip, IconButton, Tooltip } from '@mui/joy';
import { Check, Eye, EyeOff, Pencil, X } from 'lucide-react';
import { ContentItem, ContentKind, Show } from '../../models/Content';
import { tmdbUrl } from '../../utils/tmdb';
import { KindChip, showMetaLine, kindAccent, EpisodeProgressChip } from './kindAffordance';
import Poster from '../common/Poster';

export interface ContentRowProps {
  item: ContentItem;
  kind: ContentKind;
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

const cellStyle: React.CSSProperties = {
  verticalAlign: 'middle',
  padding: '8px 16px',
};

const cellStyleNarrow: React.CSSProperties = {
  verticalAlign: 'middle',
  padding: '12px 16px',
};

const cellStyleNoWrap: React.CSSProperties = {
  ...cellStyleNarrow,
  whiteSpace: 'nowrap',
};

const cellStyleCenter: React.CSSProperties = {
  verticalAlign: 'middle',
  padding: '12px 8px',
  textAlign: 'center',
};

const cellStyleSeen: React.CSSProperties = {
  verticalAlign: 'middle',
  padding: '0 4px',
  textAlign: 'center',
};

const cellStyleActions: React.CSSProperties = {
  verticalAlign: 'middle',
  padding: '0 12px',
  textAlign: 'right',
  whiteSpace: 'nowrap',
};

const recentlyAddedRowStyle: React.CSSProperties = {
  background: 'rgba(var(--joy-palette-primary-mainChannel) / 0.06)',
  boxShadow: 'inset 3px 0 0 var(--joy-palette-primary-400)',
};

const ContentRow: React.FC<ContentRowProps> = ({
  item,
  kind,
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
  const seenLabel = isSeen ? `Remove "Seen it" from ${item.title}` : `Mark ${item.title} as seen`;
  const seenTooltip =
    seenCount > 0
      ? `Seen by: ${seenNames.join(', ')}`
      : isSeen
        ? 'Remove "Seen it"'
        : "I've seen this";

  return (
    <tr style={isRecentlyAdded ? recentlyAddedRowStyle : undefined}>
      {/* Title */}
      <td style={{ ...cellStyle, borderLeft: `3px solid ${kindAccent(kind)}` }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Poster url={item.poster_url} size="xs" />
          <Box sx={{ minWidth: 0 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, flexWrap: 'wrap' }}>
              <Typography level="body-sm" sx={{ fontWeight: 600, color: 'text.primary' }}>
                {item.title}
              </Typography>
              <KindChip kind={kind} />
            </Box>
            {show && (meta || progress || canEditProgress) && (
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 0.75,
                  mt: 0.25,
                  flexWrap: 'wrap',
                }}
              >
                {meta && (
                  <Typography level="body-xs" sx={{ color: 'text.tertiary' }}>
                    {meta}
                  </Typography>
                )}
                <EpisodeProgressChip value={progress} />
                {canEditProgress && (
                  <Tooltip title={progress ? 'Edit progress' : 'Set progress'} arrow>
                    <IconButton
                      size="sm"
                      variant="plain"
                      color="neutral"
                      onClick={() => onEditProgress!(show)}
                      aria-label={
                        progress
                          ? `Edit progress for ${item.title}`
                          : `Set progress for ${item.title}`
                      }
                      sx={{
                        '--IconButton-size': '20px',
                        minHeight: 20,
                        minWidth: 20,
                        opacity: 0.5,
                        '&:hover': { opacity: 1 },
                      }}
                    >
                      <Pencil size={12} strokeWidth={2.25} />
                    </IconButton>
                  </Tooltip>
                )}
              </Box>
            )}
          </Box>
        </Box>
      </td>

      {/* Suggested by */}
      <td style={cellStyleNarrow}>
        <Chip size="sm" variant="soft" color="neutral" sx={{ fontWeight: 500 }}>
          {item.requester}
        </Chip>
      </td>

      {/* Date */}
      <td style={cellStyleNoWrap}>
        <Typography level="body-xs" sx={{ color: 'text.secondary' }}>
          {new Date(item.date_submitted).toLocaleDateString(undefined, {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
          })}
        </Typography>
      </td>

      {/* TMDB */}
      <td style={cellStyleCenter}>
        {item.tmdb_id ? (
          <a
            href={tmdbUrl(kind, item.tmdb_id)}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`View ${item.title} on TMDB (opens in new tab)`}
            style={{ color: 'var(--joy-palette-primary-500)', fontSize: '0.75rem' }}
          >
            ↗
          </a>
        ) : null}
      </td>

      {/* Seen it */}
      {isAuthenticated && (
        <td style={cellStyleSeen}>
          <Tooltip title={seenTooltip} placement="top" arrow>
            <IconButton
              size="sm"
              variant={isSeen ? 'soft' : 'plain'}
              color={isSeen ? 'warning' : 'neutral'}
              onClick={() => onToggleSeen(item.id, isSeen)}
              aria-label={seenLabel}
              aria-pressed={isSeen}
              sx={{
                opacity: isSeen ? 0.95 : 0.5,
                transition: 'opacity 0.15s',
                '&:hover': { opacity: 1 },
              }}
            >
              {isSeen ? (
                <Eye size={16} strokeWidth={2.25} />
              ) : (
                <EyeOff size={16} strokeWidth={2.25} />
              )}
              {seenCount > 0 && (
                <Typography
                  component="span"
                  level="body-xs"
                  sx={{ ml: 0.25, fontWeight: 700, fontSize: '0.6rem' }}
                  aria-label={`Seen by ${seenCount}`}
                >
                  {seenCount}
                </Typography>
              )}
            </IconButton>
          </Tooltip>
        </td>
      )}

      {/* Actions */}
      {(canMarkWatched || isAdmin) && (
        <td style={cellStyleActions}>
          {canMarkWatched && (
            <IconButton
              size="sm"
              color="success"
              variant="plain"
              onClick={() => onMarkWatched(item.id, item.title)}
              aria-label={`Mark "${item.title}" as done`}
              title={`Mark "${item.title}" as done`}
              sx={{
                opacity: 0.5,
                transition: 'opacity 0.15s',
                '&:hover': { opacity: 1 },
                mr: isAdmin ? 0.5 : 0,
              }}
            >
              <Check size={16} strokeWidth={2.5} />
            </IconButton>
          )}
          {isAdmin && (
            <IconButton
              size="sm"
              color="danger"
              variant="plain"
              onClick={() => onDelete(item.id, item.title)}
              aria-label={`Remove "${item.title}"`}
              title={`Remove "${item.title}"`}
              sx={{
                opacity: 0.5,
                transition: 'opacity 0.15s',
                '&:hover': { opacity: 1 },
              }}
            >
              <X size={16} strokeWidth={2.5} />
            </IconButton>
          )}
        </td>
      )}
    </tr>
  );
};

export default ContentRow;
