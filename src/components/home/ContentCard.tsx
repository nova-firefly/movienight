import React from 'react';
import { Box, Typography, Chip, IconButton, Tooltip, Sheet } from '@mui/joy';
import { Check, Eye, EyeOff, X } from 'lucide-react';
import { ContentItem, ContentKind, Show } from '../../models/Content';
import { tmdbUrl } from '../../utils/tmdb';
import { KindChip, showMetaLine, kindAccent, ReservedProgressSlot } from './kindAffordance';
import Poster from '../common/Poster';

export interface ContentCardProps {
  item: ContentItem;
  // Threaded now so Phase 4 (kind-aware TMDB links, kind chip) is a small diff.
  // Every callsite passes "movie" in this phase; behaviour is unchanged.
  kind: ContentKind;
  rank?: number;
  isAdmin: boolean;
  canMarkWatched: boolean;
  onMarkWatched: (id: string, title: string) => void;
  onDelete: (id: string, title: string) => void;
  onToggleSeen: (id: string, currentlySeen: boolean) => void;
  isAuthenticated: boolean;
  isRecentlyAdded?: boolean;
}

const ContentCard: React.FC<ContentCardProps> = ({
  item,
  kind,
  rank,
  isAdmin,
  canMarkWatched,
  onMarkWatched,
  onDelete,
  onToggleSeen,
  isAuthenticated,
  isRecentlyAdded = false,
}) => {
  const show = kind === 'show' ? (item as Show) : null;
  const meta = show ? showMetaLine(show) : '';
  const isSeen = item.myTags?.some((t) => t.tag.slug === 'seen') ?? false;
  const seenByUsers = (item.userTags ?? []).filter((t) => t.tag.slug === 'seen');
  const seenCount = seenByUsers.length;
  const seenNames = seenByUsers.map((t) => t.user.display_name || t.user.username);

  return (
    <Sheet
      variant="outlined"
      sx={{
        borderRadius: 'md',
        mb: 1,
        p: 1.5,
        borderColor: isRecentlyAdded ? 'primary.400' : 'var(--mn-border-vis)',
        borderWidth: isRecentlyAdded ? 1.5 : 1,
        borderLeft: `3px solid ${kindAccent(kind)}`,
        bgcolor: isRecentlyAdded
          ? 'rgba(var(--joy-palette-primary-mainChannel) / 0.06)'
          : undefined,
      }}
    >
      <Box sx={{ display: 'flex', gap: 1.5 }}>
        {/* Rank */}
        {rank != null && (
          <Typography
            level="body-xs"
            sx={{
              fontWeight: 700,
              color: rank <= 3 ? 'primary.400' : 'text.tertiary',
              minWidth: 20,
              textAlign: 'right',
              pt: 0.5,
              flexShrink: 0,
            }}
          >
            {rank}
          </Typography>
        )}
        {/* Poster */}
        <Poster url={item.poster_url} size="sm" />

        {/* Details */}
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography level="body-sm" sx={{ fontWeight: 600, color: 'text.primary' }}>
            {item.title}
            {item.tmdb_id && (
              <a
                href={tmdbUrl(kind, item.tmdb_id)}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`View ${item.title} on TMDB (opens in new tab)`}
                style={{
                  color: 'var(--joy-palette-primary-500)',
                  fontSize: '0.7rem',
                  marginLeft: 4,
                }}
              >
                ↗
              </a>
            )}
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.25, flexWrap: 'wrap' }}>
            <KindChip kind={kind} />
            <Chip
              size="sm"
              variant="soft"
              color="neutral"
              sx={{ fontWeight: 500, fontSize: '0.65rem' }}
            >
              {item.requester}
            </Chip>
            <Typography level="body-xs" sx={{ color: 'text.tertiary' }}>
              {new Date(item.date_submitted).toLocaleDateString(undefined, {
                month: 'short',
                day: 'numeric',
              })}
            </Typography>
          </Box>
          {show && (
            <Box
              sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mt: 0.25, flexWrap: 'wrap' }}
            >
              {meta && (
                <Typography level="body-xs" sx={{ color: 'text.tertiary' }}>
                  {meta}
                </Typography>
              )}
              <ReservedProgressSlot />
            </Box>
          )}
        </Box>
      </Box>

      {/* Actions */}
      {(isAuthenticated || canMarkWatched || isAdmin) && (
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'flex-end',
            gap: 0.5,
            mt: 1,
            pt: 0.5,
            borderTop: '1px solid',
            borderColor: 'var(--mn-border)',
          }}
        >
          {isAuthenticated && (
            <Tooltip
              title={
                seenCount > 0
                  ? `Seen by: ${seenNames.join(', ')}`
                  : isSeen
                    ? 'Remove "Seen it"'
                    : "I've seen this"
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
                sx={{
                  opacity: isSeen ? 0.95 : 0.5,
                  '&:hover': { opacity: 1 },
                  minWidth: 36,
                  minHeight: 36,
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
                  >
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
              variant="soft"
              onClick={() => onMarkWatched(item.id, item.title)}
              aria-label={`Mark "${item.title}" as done`}
              sx={{ minWidth: 36, minHeight: 36 }}
            >
              <Check size={16} strokeWidth={2.5} />
            </IconButton>
          )}
          {isAdmin && (
            <IconButton
              size="sm"
              color="danger"
              variant="soft"
              onClick={() => onDelete(item.id, item.title)}
              aria-label={`Remove "${item.title}"`}
              sx={{ minWidth: 36, minHeight: 36 }}
            >
              <X size={16} strokeWidth={2.5} />
            </IconButton>
          )}
        </Box>
      )}
    </Sheet>
  );
};

export default ContentCard;
