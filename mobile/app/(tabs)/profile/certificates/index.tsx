import { useCallback } from 'react';
import { View, Text, FlatList, RefreshControl, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useBranding } from '@/lib/contexts/branding-context';
import { useApi } from '@/lib/hooks/use-api';
import { useMutation } from '@/lib/hooks/use-mutation';
import { getStudentDashboard, requestCertificate, downloadCertificate } from '@/lib/api/certificates';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { IconButton } from '@/components/ui/IconButton';
import { PageLoading } from '@/components/shared/PageLoading';
import { PageError } from '@/components/shared/PageError';
import { EmptyState } from '@/components/shared/EmptyState';
import { Colors } from '@/lib/constants/colors';
import { showSuccess, showError } from '@/lib/utils/toast';
import type { StudentDashboardCourse } from '@/lib/types/certificate';

export default function CertificatesScreen() {
  const router = useRouter();
  const { accentColor } = useBranding();
  const accent = accentColor || Colors.accent;

  const { data: courses, loading, error, refetch } = useApi(
    () => getStudentDashboard(),
    [],
  );

  const requestMutation = useMutation(requestCertificate);

  const handleRequest = useCallback(
    async (course: StudentDashboardCourse) => {
      try {
        await requestMutation.execute({
          batchId: course.batchId,
          courseId: course.courseId,
          certificateName: course.certificateName || course.courseTitle,
        });
        showSuccess('Certificate requested successfully');
        refetch();
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Failed to request certificate';
        showError(msg);
      }
    },
    [requestMutation, refetch],
  );

  const handleDownload = useCallback(async (certId: string) => {
    try {
      const { downloadUrl } = await downloadCertificate(certId);
      const { downloadAndShare } = await import('@/lib/utils/download');
      await downloadAndShare(downloadUrl, 'certificate.pdf');
      showSuccess('Certificate downloaded');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Download failed';
      showError(msg);
    }
  }, []);

  const statusConfig = (status: string) => {
    switch (status) {
      case 'not_started':
        return { label: 'Not Started', variant: 'default' as const };
      case 'in_progress':
        return { label: 'In Progress', variant: 'info' as const };
      case 'eligible':
        return { label: 'Eligible', variant: 'success' as const };
      case 'pending':
        return { label: 'Pending Review', variant: 'warning' as const };
      case 'approved':
        return { label: 'Approved', variant: 'success' as const };
      case 'revoked':
        return { label: 'Revoked', variant: 'error' as const };
      default:
        return { label: status, variant: 'default' as const };
    }
  };

  if (loading) return <PageLoading />;
  if (error) return <PageError message={error} onRetry={refetch} />;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <IconButton name="arrow-back" onPress={() => router.back()} />
        <Text style={styles.title}>Certificates</Text>
      </View>

      <FlatList
        data={courses ?? []}
        keyExtractor={(item) => `${item.batchId}-${item.courseId}`}
        contentContainerStyle={[styles.listContent, (!courses || courses.length === 0) && styles.emptyContent]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={false} onRefresh={refetch} tintColor={Colors.primary} />
        }
        ListEmptyComponent={
          <EmptyState icon="ribbon-outline" title="No courses" description="Your enrolled courses will appear here" />
        }
        renderItem={({ item }) => {
          const badge = statusConfig(item.status);
          return (
            <Card style={styles.certCard}>
              <View style={styles.certHeader}>
                <View style={styles.certInfo}>
                  <Text style={styles.courseTitle} numberOfLines={2}>{item.courseTitle}</Text>
                  <Text style={styles.batchName}>{item.batchName}</Text>
                </View>
                <Badge label={badge.label} variant={badge.variant} />
              </View>

              <View style={styles.progressSection}>
                <View style={styles.progressRow}>
                  <Text style={styles.progressLabel}>
                    Progress: {Math.round(item.completionPercentage)}%
                  </Text>
                  <Text style={styles.thresholdLabel}>
                    Threshold: {item.threshold}%
                  </Text>
                </View>
                <ProgressBar
                  progress={item.completionPercentage}
                  color={item.completionPercentage >= item.threshold ? Colors.success : accent}
                />
              </View>

              {item.status === 'eligible' && (
                <Button
                  title="Request Certificate"
                  onPress={() => handleRequest(item)}
                  variant="primary"
                  icon="ribbon"
                  fullWidth
                  loading={requestMutation.loading}
                  accentColor={accent}
                  style={styles.actionBtn}
                />
              )}
              {item.status === 'approved' && item.certificateId && (
                <Button
                  title="Download Certificate"
                  onPress={() => handleDownload(item.certificateId!)}
                  variant="primary"
                  icon="download"
                  fullWidth
                  accentColor={Colors.success}
                  style={styles.actionBtn}
                />
              )}
            </Card>
          );
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.text,
    marginLeft: 8,
  },
  listContent: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 20,
  },
  emptyContent: {
    flexGrow: 1,
  },
  certCard: {
    marginBottom: 12,
  },
  certHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  certInfo: {
    flex: 1,
    marginRight: 8,
  },
  courseTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.text,
  },
  batchName: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  progressSection: {
    marginTop: 12,
  },
  progressRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  progressLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: Colors.text,
  },
  thresholdLabel: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  actionBtn: {
    marginTop: 12,
  },
});
