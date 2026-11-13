import React from 'react';
import { Box, Typography, IconButton, Tooltip } from '@mui/joy';
import { Check, ExternalLink, Eye, EyeOff, X } from 'lucide-react';
import { ContentItem, ContentKind, Show } from '../../models/Content';
import { tmdbUrl } from '../../utils/tmdb';
import { KindChip, showMetaLine, EpisodeProgressControl, RankNumeral } from './kindAffordance';
import Poster from '../common/Poster';

export interface ContentRowProps {
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

const cellStyle: React.CSSProperties = {
  verticalAlign: 'middle',
  padding: '12px 16px',
  borderBottom: '1px solid var(--color-rule)',
};

const cellStyleRank: React.CSSProperties = {
  ...cellStyle,
  padding: '12px 8px 12px 0',
  width: 56,
};

const cellStyleNoWrap: React.CSSProperties = {
  ...cellStyle,
  whiteSpace: 'nowrap',
};

const cellStyleCenter: React.CSSProperties = {
  ...cellStyle,
  padding: '12px 8px',
  textAlign: 'center',
};

const cellStyleActions: React.CSSProperties = {
  ...cellStyle,
  padding: '12px 0 12px 8px',
  textAlign: 'right',
  whiteSpace: 'nowrap',
};

const recentlyAddedRowStyle: React.CSSProperties = {
  background: 'rgba(var(--joy-palette-primary-mainChannel) / 0.07)',
};

// Quiet until the row is hovered or focused, so the ledger reads as titles first.
const quietAction = {
  opacity: 0.55,
  transitionProperty: 'opacity',
  transitionDuration: 'var(--dur-micro)',
  'tr:hover &, &:hover, &:focus-visible': { opacity: 1 },
};

const ContentRow: React.FC<ContentRowProps> = ({
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
  const seenLabel = isSeen ? `Remove "Seen it" from ${item.title}` : `Mark ${item.title} as seen`;
  const seenTooltip =
    seenCount > 0
      ? `Seen by: ${seenNames.join(', ')}`
      : isSeen
        ? 'Remove “Seen it”'
        : 'I’ve seen this';

  return (
    <tr style={isRecentlyAdded ? recentlyAddedRowStyle : undefined}>
      {/* Rank */}
      {rank != null && (
        <td style={cellStyleRank}>
          <RankNumeral rank={rank} kind={kind} />
        </td>
      )}

      {/* Title */}
      <td style={cellStyle}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Poster url={item.poster_url} size="sm" />
          <Box sx={{ minWidth: 0 }}>
            <Typography
              level="title-md"
              sx={{ fontWeight: 600, color: 'text.primary', lineHeight: 1.3 }}
            >
              {item.title}
            </Typography>
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1.5,
                mt: 0.5,
                flexWrap: 'wrap',
              }}
            >
              <KindChip kind={kind} />
              {meta && (
                <Typography level="body-xs" sx={{ color: 'text.tertiary' }}>
                  {meta}
                </Typography>
              )}
              {show && (
                <EpisodeProgressControl
                  title={item.title}
                  value={progress}
                  onEdit={canEditProgress ? () => onEditProgress!(show) : undefined}
                />
              )}
            </Box>
          </Box>
        </Box>
      </td>

      {/* Suggested by */}
      <td style={cellStyle}>
        <Typography level="body-sm" sx={{ color: 'text.secondary' }}>
          {item.requester}
        </Typography>
      </td>

      {/* Date */}
      <td style={cellStyleNoWrap}>
        <Typography level="body-sm" sx={{ color: 'text.tertiary' }}>
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
          <IconButton
            component="a"
            href={tmdbUrl(kind, item.tmdb_id)}
            target="_blank"
            rel="noopener noreferrer"
            size="sm"
            variant="plain"
            color="neutral"
            aria-label={`View ${item.title} on TMDB (opens in new tab)`}
            sx={quietAction}
          >
            <ExternalLink size={16} strokeWidth={2} />
          </IconButton>
        ) : null}
      </td>

      {/* Seen it */}
      {isAuthenticated && (
        <td style={cellStyleCenter}>
          <Tooltip title={seenTooltip} placement="top" arrow>
            <IconButton
              size="sm"
              variant={isSeen ? 'soft' : 'plain'}
              color={isSeen ? 'warning' : 'neutral'}
              onClick={() => onToggleSeen(item.id, isSeen)}
              aria-label={seenLabel}
              aria-pressed={isSeen}
              sx={isSeen ? undefined : quietAction}
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
                  sx={{ ml: 0.25, fontWeight: 600 }}
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
              title={`Mark “${item.title}” as done`}
              sx={{ ...quietAction, mr: isAdmin ? 0.5 : 0 }}
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
              title={`Remove “${item.title}”`}
              sx={quietAction}
            >
              <X size={18} strokeWidth={2.5} />
            </IconButton>
          )}
        </td>
      )}
    </tr>
  );
};

export default ContentRow;
