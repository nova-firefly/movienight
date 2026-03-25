import React, { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@apollo/client';
import {
  Box,
  CircularProgress,
  Typography,
  Button,
  Alert,
  Sheet,
  Divider,
  Switch,
  Select,
  Option,
  Input,
  FormLabel,
  FormControl,
} from '@mui/joy';
import {
  GET_MOVIES,
  EXPORT_KOMETA,
  GET_KOMETA_SCHEDULE,
  UPDATE_KOMETA_SCHEDULE,
  GET_APP_INFO,
} from '../../graphql/queries';

interface Movie {
  id: string;
  title: string;
  rank: number;
  tmdb_id: number | null;
}

interface ScheduleData {
  enabled: boolean;
  frequency: string;
  dailyTime: string;
  collectionName: string | null;
  lastRunAt: string | null;
}

function generateKometaYaml(movies: Movie[], collectionName: string): string {
  const matched = movies.filter((m) => m.tmdb_id != null);
  const today = new Date().toISOString().split('T')[0];
  const idLines = matched.map((m) => `      - ${m.tmdb_id}`).join('\n');
  return (
    `collections:\n` +
    `  ${collectionName}:\n` +
    `    tmdb_movie:\n` +
    `${idLines}\n` +
    `    sync_mode: sync\n` +
    `    radarr_add_missing: true\n` +
    `    radarr_search: true\n` +
    `    visible_home: true\n` +
    `    visible_shared: true\n` +
    `    summary: "MovieNight watchlist — exported ${today}"\n`
  );
}

export const KometaExport: React.FC = () => {
  const { data, loading } = useQuery(GET_MOVIES, {
    fetchPolicy: 'cache-and-network',
  });
  const [exportKometa, { loading: exporting }] = useMutation(EXPORT_KOMETA);

  const { data: scheduleData, loading: scheduleLoading } = useQuery(GET_KOMETA_SCHEDULE, {
    fetchPolicy: 'cache-and-network',
  });
  const { data: appInfoData } = useQuery(GET_APP_INFO, { fetchPolicy: 'cache-first' });
  const isProd = appInfoData?.appInfo?.isProduction ?? true;
  const [updateSchedule, { loading: savingSchedule }] = useMutation(UPDATE_KOMETA_SCHEDULE);

  const [copied, setCopied] = useState(false);
  const [exportResult, setExportResult] = useState<{
    path: string;
    triggered: boolean;
    triggerError?: string;
  } | { error: string } | null>(null);

  // Local form state for schedule
  const [schedEnabled, setSchedEnabled] = useState(false);
  const [schedFrequency, setSchedFrequency] = useState('daily');
  const [schedDailyTime, setSchedDailyTime] = useState('03:00');
  const [schedSaveResult, setSchedSaveResult] = useState<'saved' | { error: string } | null>(null);

  // Sync form state when server data loads
  useEffect(() => {
    const s: ScheduleData | undefined = scheduleData?.kometaSchedule;
    if (s) {
      setSchedEnabled(s.enabled);
      setSchedFrequency(s.frequency);
      setSchedDailyTime(s.dailyTime);
    }
  }, [scheduleData]);

  const collectionName = 'MovieNight Watchlist';

  const movies: Movie[] = [...(data?.movies ?? [])].sort(
    (a: Movie, b: Movie) => a.rank - b.rank
  );
  const matched = movies.filter((m) => m.tmdb_id != null);
  const unmatched = movies.filter((m) => m.tmdb_id == null);
  const yaml = movies.length > 0 ? generateKometaYaml(movies, collectionName) : '';

  const handleCopy = async () => {
    await navigator.clipboard.writeText(yaml);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const blob = new Blob([yaml], { type: 'text/yaml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'movienight.yml';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExport = async () => {
    setExportResult(null);
    try {
      const { data: result } = await exportKometa({
        variables: { collectionName },
      });
      const { filePath, triggered, triggerError } = result.exportKometa;
      setExportResult({ path: filePath, triggered, triggerError });
    } catch (err: any) {
      setExportResult({ error: err.message });
    }
  };

  const handleSaveSchedule = async () => {
    setSchedSaveResult(null);
    try {
      await updateSchedule({
        variables: {
          enabled: schedEnabled,
          frequency: schedFrequency,
          dailyTime: schedDailyTime,
        },
      });
      setSchedSaveResult('saved');
      setTimeout(() => setSchedSaveResult(null), 3000);
    } catch (err: any) {
      setSchedSaveResult({ error: err.message });
    }
  };

  const lastRun: string | null = scheduleData?.kometaSchedule?.lastRunAt ?? null;

  if (loading && movies.length === 0) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
        <CircularProgress size="md" color="primary" />
      </Box>
    );
  }

  return (
    <Box>
      <Typography level="title-md" fontWeight={700} sx={{ color: 'text.secondary', mb: 1 }}>
        {matched.length} of {movies.length} movies exportable (have TMDB ID)
      </Typography>

      <Typography level="body-sm" sx={{ color: 'text.tertiary', mb: 2 }}>
        Generates a Kometa collection file using{' '}
        <code>tmdb_movie</code> + <code>collection_order: release</code> sorted
        by release date.{' '}
        <strong>Write to Kometa</strong> writes directly to the configured{' '}
        <code>KOMETA_COLLECTIONS_PATH</code> on the server.
      </Typography>

      {unmatched.length > 0 && (
        <Alert color="warning" sx={{ mb: 2 }}>
          <Box>
            <Typography level="title-sm" fontWeight={700}>
              {unmatched.length} movie{unmatched.length > 1 ? 's' : ''} skipped — no TMDB ID
            </Typography>
            <Typography level="body-xs" sx={{ mt: 0.5, opacity: 0.85 }}>
              {unmatched.map((m) => m.title).join(', ')}
            </Typography>
          </Box>
        </Alert>
      )}

      {exportResult && (
        <Alert
          color={'error' in exportResult ? 'danger' : 'success'}
          sx={{ mb: 2 }}
        >
          {'error' in exportResult ? (
            exportResult.error
          ) : (
            <Box>
              <Typography level="body-sm">Written to {exportResult.path}</Typography>
              {exportResult.triggered && (
                <Typography level="body-xs" sx={{ mt: 0.5, opacity: 0.8 }}>
                  Kometa run triggered.
                </Typography>
              )}
              {exportResult.triggerError && (
                <Typography level="body-xs" sx={{ mt: 0.5, color: 'warning.600' }}>
                  Could not trigger Kometa run: {exportResult.triggerError}
                </Typography>
              )}
            </Box>
          )}
        </Alert>
      )}

      {!isProd && (
        <Alert color="warning" sx={{ mb: 2 }}>
          <Typography level="body-sm">
            <strong>Dev/test environment:</strong> Direct write to Kometa and scheduled exports are
            disabled to protect production systems.
          </Typography>
        </Alert>
      )}

      {matched.length === 0 ? (
        <Alert color="danger" sx={{ mb: 2 }}>
          No movies have TMDB IDs. Use the TMDB match feature on the homepage to
          link movies before exporting.
        </Alert>
      ) : (
        <>
          <Box sx={{ display: 'flex', gap: 1, mb: 2, flexWrap: 'wrap' }}>
            <Button
              size="sm"
              variant="solid"
              color="primary"
              loading={exporting}
              onClick={handleExport}
              disabled={!isProd}
            >
              Write to Kometa
            </Button>
            <Button
              size="sm"
              variant="outlined"
              color="neutral"
              onClick={handleDownload}
            >
              Download .yml
            </Button>
            <Button
              size="sm"
              variant="outlined"
              color={copied ? 'success' : 'neutral'}
              onClick={handleCopy}
            >
              {copied ? 'Copied!' : 'Copy to clipboard'}
            </Button>
          </Box>

          <Sheet
            variant="outlined"
            sx={{
              borderRadius: 'md',
              borderColor: 'var(--mn-border-vis)',
              overflow: 'auto',
              maxHeight: 480,
            }}
          >
            <Box
              component="pre"
              sx={{
                m: 0,
                p: 2,
                fontSize: '0.8rem',
                fontFamily: 'monospace',
                lineHeight: 1.6,
                color: 'text.primary',
                whiteSpace: 'pre',
              }}
            >
              {yaml}
            </Box>
          </Sheet>
        </>
      )}

      <Divider sx={{ my: 3 }} />

      <Typography level="title-sm" fontWeight={700} sx={{ mb: 2 }}>
        Scheduled Export
      </Typography>

      {scheduleLoading && !scheduleData ? (
        <CircularProgress size="sm" />
      ) : (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, maxWidth: 380 }}>
          <FormControl orientation="horizontal" sx={{ justifyContent: 'space-between' }}>
            <FormLabel>
              Enable scheduled export
              {!isProd && (
                <Typography level="body-xs" sx={{ color: 'warning.600', ml: 1 }}>
                  (production only)
                </Typography>
              )}
            </FormLabel>
            <Switch
              checked={schedEnabled}
              onChange={(e) => setSchedEnabled(e.target.checked)}
              size="sm"
              disabled={!isProd}
            />
          </FormControl>

          <FormControl>
            <FormLabel>Frequency</FormLabel>
            <Select
              size="sm"
              value={schedFrequency}
              onChange={(_, v) => v && setSchedFrequency(v)}
              disabled={!schedEnabled}
            >
              <Option value="hourly">Hourly (at :00)</Option>
              <Option value="daily">Daily</Option>
            </Select>
          </FormControl>

          {schedFrequency === 'daily' && (
            <FormControl>
              <FormLabel>Time (24-hour)</FormLabel>
              <Input
                size="sm"
                type="time"
                value={schedDailyTime}
                onChange={(e) => setSchedDailyTime(e.target.value)}
                disabled={!schedEnabled}
                sx={{ maxWidth: 140 }}
              />
            </FormControl>
          )}

          {schedSaveResult && (
            <Alert
              color={schedSaveResult === 'saved' ? 'success' : 'danger'}
              size="sm"
            >
              {schedSaveResult === 'saved'
                ? 'Schedule saved'
                : (schedSaveResult as { error: string }).error}
            </Alert>
          )}

          {lastRun && (
            <Typography level="body-xs" sx={{ color: 'text.tertiary' }}>
              Last scheduled run: {new Date(lastRun).toLocaleString()}
            </Typography>
          )}

          <Box>
            <Button
              size="sm"
              variant="outlined"
              color="primary"
              loading={savingSchedule}
              onClick={handleSaveSchedule}
              disabled={!isProd}
            >
              Save Schedule
            </Button>
          </Box>
        </Box>
      )}
    </Box>
  );
};
