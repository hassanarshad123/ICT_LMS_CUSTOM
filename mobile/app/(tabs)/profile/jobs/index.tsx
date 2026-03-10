import { useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  ScrollView,
  StyleSheet,
  TextInput as RNTextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useBranding } from '@/lib/contexts/branding-context';
import { usePaginatedApi } from '@/lib/hooks/use-paginated-api';
import { useApi } from '@/lib/hooks/use-api';
import { useMutation } from '@/lib/hooks/use-mutation';
import { listJobs, applyToJob, getMyApplications } from '@/lib/api/jobs';
import { PaginatedFlatList } from '@/components/shared/PaginatedFlatList';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { IconButton } from '@/components/ui/IconButton';
import { Colors } from '@/lib/constants/colors';
import { formatDate } from '@/lib/utils/format';
import { showSuccess, showError } from '@/lib/utils/toast';
import type { JobOut, Application } from '@/lib/types/job';

type ActiveTab = 'jobs' | 'applications';

export default function JobsScreen() {
  const router = useRouter();
  const { accentColor } = useBranding();
  const accent = accentColor || Colors.accent;

  const [activeTab, setActiveTab] = useState<ActiveTab>('jobs');
  const [applyModal, setApplyModal] = useState<JobOut | null>(null);
  const [coverLetter, setCoverLetter] = useState('');

  const { data: jobs, loading: jobsLoading, loadingMore, error: jobsError, hasMore, loadMore, refetch: refetchJobs } = usePaginatedApi(
    (params) => listJobs({ page: params.page, perPage: params.per_page }),
    15,
    [],
  );

  const { data: applications, loading: appsLoading, error: appsError, refetch: refetchApps } = useApi(
    () => getMyApplications(),
    [],
  );

  const applyMutation = useMutation(applyToJob);

  const appliedJobIds = new Set((applications ?? []).map((a) => a.jobId));

  const handleApply = useCallback(
    async (job: JobOut) => {
      if (appliedJobIds.has(job.id)) return;
      setApplyModal(job);
      setCoverLetter('');
    },
    [appliedJobIds],
  );

  const submitApplication = useCallback(async () => {
    if (!applyModal) return;
    try {
      await applyMutation.execute(applyModal.id, { coverLetter: coverLetter || undefined });
      showSuccess('Application submitted!');
      setApplyModal(null);
      refetchApps();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to apply';
      showError(msg);
    }
  }, [applyModal, coverLetter, applyMutation, refetchApps]);

  const jobTypeBadge = (type: string) => {
    switch (type) {
      case 'full-time':
      case 'full_time':
        return 'success' as const;
      case 'part-time':
      case 'part_time':
        return 'info' as const;
      case 'internship':
        return 'warning' as const;
      case 'contract':
        return 'default' as const;
      default:
        return 'default' as const;
    }
  };

  const appStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return 'warning' as const;
      case 'accepted':
      case 'approved':
        return 'success' as const;
      case 'rejected':
        return 'error' as const;
      default:
        return 'default' as const;
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <IconButton name="arrow-back" onPress={() => router.back()} />
        <Text style={styles.title}>Job Board</Text>
      </View>

      {/* Tab bar */}
      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'jobs' && { borderBottomColor: accent }]}
          onPress={() => setActiveTab('jobs')}
          activeOpacity={0.7}
        >
          <Text style={[styles.tabText, activeTab === 'jobs' && { color: accent, fontWeight: '600' }]}>
            Jobs ({jobs.length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'applications' && { borderBottomColor: accent }]}
          onPress={() => setActiveTab('applications')}
          activeOpacity={0.7}
        >
          <Text style={[styles.tabText, activeTab === 'applications' && { color: accent, fontWeight: '600' }]}>
            My Applications ({applications?.length ?? 0})
          </Text>
        </TouchableOpacity>
      </View>

      {activeTab === 'jobs' ? (
        <PaginatedFlatList
          data={jobs}
          loading={jobsLoading}
          loadingMore={loadingMore}
          error={jobsError}
          hasMore={hasMore}
          onLoadMore={loadMore}
          onRefresh={refetchJobs}
          keyExtractor={(item) => item.id}
          emptyIcon="briefcase-outline"
          emptyTitle="No jobs posted"
          emptyDescription="Check back later for new opportunities"
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => {
            const hasApplied = appliedJobIds.has(item.id);
            return (
              <Card style={styles.jobCard}>
                <View style={styles.jobHeader}>
                  <View style={styles.jobInfo}>
                    <Text style={styles.jobTitle} numberOfLines={2}>{item.title}</Text>
                    <Text style={styles.jobCompany}>{item.company}</Text>
                  </View>
                  <Badge label={item.type.replace('_', '-')} variant={jobTypeBadge(item.type)} />
                </View>
                <View style={styles.jobMeta}>
                  {item.location && (
                    <View style={styles.metaItem}>
                      <Ionicons name="location-outline" size={14} color={Colors.textSecondary} />
                      <Text style={styles.metaText}>{item.location}</Text>
                    </View>
                  )}
                  {item.salary && (
                    <View style={styles.metaItem}>
                      <Ionicons name="cash-outline" size={14} color={Colors.textSecondary} />
                      <Text style={styles.metaText}>{item.salary}</Text>
                    </View>
                  )}
                  {item.deadline && (
                    <View style={styles.metaItem}>
                      <Ionicons name="time-outline" size={14} color={Colors.textSecondary} />
                      <Text style={styles.metaText}>Deadline: {formatDate(item.deadline)}</Text>
                    </View>
                  )}
                </View>
                {item.description && (
                  <Text style={styles.jobDesc} numberOfLines={3}>{item.description}</Text>
                )}
                <Button
                  title={hasApplied ? 'Applied' : 'Apply'}
                  onPress={() => handleApply(item)}
                  variant={hasApplied ? 'outline' : 'primary'}
                  icon={hasApplied ? 'checkmark-circle' : 'send'}
                  fullWidth
                  disabled={hasApplied}
                  accentColor={accent}
                  style={styles.applyBtn}
                />
              </Card>
            );
          }}
        />
      ) : (
        <PaginatedFlatList
          data={applications ?? []}
          loading={appsLoading}
          loadingMore={false}
          error={appsError}
          hasMore={false}
          onLoadMore={() => {}}
          onRefresh={refetchApps}
          keyExtractor={(item) => item.id}
          emptyIcon="document-outline"
          emptyTitle="No applications"
          emptyDescription="Apply to jobs to see your applications here"
          contentContainerStyle={styles.listContent}
          renderItem={({ item }: { item: Application }) => (
            <Card style={styles.jobCard}>
              <View style={styles.jobHeader}>
                <View style={styles.jobInfo}>
                  <Text style={styles.jobTitle} numberOfLines={2}>{item.jobTitle ?? 'Job'}</Text>
                  {item.company && <Text style={styles.jobCompany}>{item.company}</Text>}
                </View>
                <Badge label={item.status} variant={appStatusBadge(item.status)} />
              </View>
              {item.appliedAt && (
                <Text style={styles.metaText}>Applied {formatDate(item.appliedAt)}</Text>
              )}
            </Card>
          )}
        />
      )}

      {/* Apply Modal */}
      <Modal visible={!!applyModal} animationType="slide" transparent>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Apply to {applyModal?.title}</Text>
              <IconButton name="close" onPress={() => setApplyModal(null)} />
            </View>
            <Text style={styles.modalLabel}>Cover Letter (optional)</Text>
            <RNTextInput
              style={styles.textArea}
              multiline
              numberOfLines={6}
              placeholder="Write a brief cover letter..."
              placeholderTextColor={Colors.textTertiary}
              value={coverLetter}
              onChangeText={setCoverLetter}
              textAlignVertical="top"
            />
            <Button
              title="Submit Application"
              onPress={submitApplication}
              variant="primary"
              icon="send"
              fullWidth
              loading={applyMutation.loading}
              accentColor={accent}
              style={styles.submitBtn}
            />
          </View>
        </KeyboardAvoidingView>
      </Modal>
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
  tabBar: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
    marginHorizontal: 20,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabText: {
    fontSize: 13,
    fontWeight: '500',
    color: Colors.textSecondary,
  },
  listContent: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 20,
  },
  jobCard: {
    marginBottom: 12,
  },
  jobHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  jobInfo: {
    flex: 1,
    marginRight: 8,
  },
  jobTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.text,
  },
  jobCompany: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  jobMeta: {
    marginTop: 8,
    gap: 4,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  metaText: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  jobDesc: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginTop: 8,
    lineHeight: 18,
  },
  applyBtn: {
    marginTop: 12,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: Colors.overlay,
  },
  modalContent: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 40,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.text,
    flex: 1,
    marginRight: 8,
  },
  modalLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.text,
    marginBottom: 8,
  },
  textArea: {
    backgroundColor: Colors.surfaceSecondary,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 14,
    fontSize: 14,
    color: Colors.text,
    minHeight: 120,
  },
  submitBtn: {
    marginTop: 16,
  },
});
