import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:ict_lms_student/core/constants/app_colors.dart';
import 'package:ict_lms_student/core/constants/app_shadows.dart';
import 'package:ict_lms_student/core/constants/app_spacing.dart';
import 'package:ict_lms_student/core/utils/responsive.dart';
import 'package:ict_lms_student/core/theme/app_text_styles.dart';
import 'package:ict_lms_student/data/repositories/job_repository.dart';
import 'package:ict_lms_student/features/profile/providers/jobs_provider.dart';
import 'package:ict_lms_student/shared/widgets/shimmer_loading.dart';
import 'package:ict_lms_student/features/profile/widgets/apply_bottom_sheet.dart';
import 'package:ict_lms_student/models/job_out.dart';
import 'package:ict_lms_student/shared/widgets/status_badge.dart';
import 'package:intl/intl.dart';

/// Provider that fetches a single job by ID.
final jobDetailProvider =
    FutureProvider.autoDispose.family<JobOut, String>((ref, jobId) async {
  final repo = ref.watch(jobRepositoryProvider);
  return repo.getJob(jobId);
});

class JobDetailScreen extends ConsumerWidget {
  final String jobId;

  const JobDetailScreen({super.key, required this.jobId});

  Future<void> _applyToJob(
    BuildContext context,
    WidgetRef ref,
    JobOut job,
  ) async {
    final result = await ApplyBottomSheet.show(
      context: context,
      jobTitle: job.title,
      company: job.company,
      onApply: (coverLetter) async {
        final repo = ref.read(jobRepositoryProvider);
        await repo.applyToJob(
          jobId: job.id,
          coverLetter: coverLetter,
        );
      },
    );

    if (result == true && context.mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Application submitted successfully'),
          backgroundColor: AppColors.success,
        ),
      );
      // Refresh the job detail and applications list.
      ref.invalidate(jobDetailProvider(jobId));
      ref.invalidate(myApplicationsProvider);
    }
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final asyncData = ref.watch(jobDetailProvider(jobId));
    final accentColor = Theme.of(context).colorScheme.primary;

    return Scaffold(
      backgroundColor: AppColors.scaffoldBg,
      appBar: AppBar(
        title: Text('Job Details', style: AppTextStyles.headline),
        backgroundColor: AppColors.cardBg,
        surfaceTintColor: Colors.transparent,
        elevation: 0,
      ),
      body: asyncData.when(
        loading: () => Padding(
          padding: const EdgeInsets.all(AppSpacing.space16),
          child: Column(children: [
            const ShimmerCard(height: 200),
            const SizedBox(height: 12),
            const ShimmerCard(height: 40),
            const SizedBox(height: 12),
            const ShimmerCard(height: 120),
          ]),
        ),
        error: (error, _) => Center(
          child: Padding(
            padding: EdgeInsets.all(Responsive.screenPadding(context)),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                const Icon(Icons.error_outline,
                    color: AppColors.error, size: 48),
                const SizedBox(height: AppSpacing.space16),
                Text(
                  error.toString().replaceFirst('Exception: ', ''),
                  style: AppTextStyles.subheadline.copyWith(
                    color: AppColors.textSecondary,
                  ),
                  textAlign: TextAlign.center,
                ),
                const SizedBox(height: AppSpacing.space16),
                TextButton(
                  onPressed: () =>
                      ref.invalidate(jobDetailProvider(jobId)),
                  child: const Text('Retry'),
                ),
              ],
            ),
          ),
        ),
        data: (job) => _JobDetailContent(
          job: job,
          accentColor: accentColor,
          onApply: job.isExpired
              ? null
              : () => _applyToJob(context, ref, job),
        ),
      ),
    );
  }
}

class _JobDetailContent extends StatelessWidget {
  final JobOut job;
  final Color accentColor;
  final VoidCallback? onApply;

  const _JobDetailContent({
    required this.job,
    required this.accentColor,
    this.onApply,
  });

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Expanded(
          child: SingleChildScrollView(
            padding: const EdgeInsets.fromLTRB(
              AppSpacing.screenH,
              AppSpacing.space20,
              AppSpacing.screenH,
              AppSpacing.space20,
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Title.
                Hero(
                  tag: 'job-${job.id}',
                  child: Material(
                    type: MaterialType.transparency,
                    child: Text(
                      job.title,
                      style: AppTextStyles.title2,
                    ),
                  ),
                ),
                const SizedBox(height: AppSpacing.space12),
                // Company + location row.
                Row(
                  children: [
                    Icon(Icons.business,
                        size: 16, color: AppColors.textTertiary),
                    const SizedBox(width: 8),
                    Text(
                      job.company,
                      style: AppTextStyles.subheadline.copyWith(
                        color: AppColors.textSecondary,
                      ),
                    ),
                  ],
                ),
                if (job.location != null &&
                    job.location!.isNotEmpty) ...[
                  const SizedBox(height: 6),
                  Row(
                    children: [
                      Icon(Icons.location_on_outlined,
                          size: 16, color: AppColors.textTertiary),
                      const SizedBox(width: 8),
                      Text(
                        job.location!,
                        style: AppTextStyles.subheadline.copyWith(
                          color: AppColors.textSecondary,
                          fontSize: 14,
                        ),
                      ),
                    ],
                  ),
                ],
                const SizedBox(height: AppSpacing.space16),
                // Info chips.
                Wrap(
                  spacing: 10,
                  runSpacing: 8,
                  children: [
                    _DetailChip(
                      icon: Icons.work_outline,
                      label: job.typeLabel,
                    ),
                    if (job.salary != null && job.salary!.isNotEmpty)
                      _DetailChip(
                        icon: Icons.payments_outlined,
                        label: job.salary!,
                      ),
                    if (job.deadline != null)
                      _DetailChip(
                        icon: Icons.event,
                        label: job.isExpired
                            ? 'Expired'
                            : 'Deadline: ${DateFormat('MMM d, yyyy').format(job.deadline!)}',
                      ),
                    if (job.postedDate != null)
                      _DetailChip(
                        icon: Icons.calendar_today,
                        label:
                            'Posted: ${DateFormat('MMM d, yyyy').format(job.postedDate!)}',
                      ),
                  ],
                ),
                if (job.isExpired) ...[
                  const SizedBox(height: AppSpacing.space12),
                  const StatusBadge(status: 'expired'),
                ],
                const SizedBox(height: AppSpacing.space24),
                // Description section.
                if (job.description != null &&
                    job.description!.isNotEmpty) ...[
                  Container(
                    width: double.infinity,
                    padding:
                        const EdgeInsets.all(AppSpacing.cardPadding),
                    decoration: BoxDecoration(
                      color: AppColors.cardBg,
                      borderRadius: BorderRadius.circular(
                          AppSpacing.cardRadius),
                      boxShadow: AppShadows.sm,
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'Description',
                          style: AppTextStyles.headline.copyWith(
                            fontSize: 16,
                          ),
                        ),
                        const SizedBox(height: AppSpacing.space8),
                        Text(
                          job.description!,
                          style: AppTextStyles.subheadline.copyWith(
                            color: AppColors.textSecondary,
                            fontSize: 14,
                            height: 1.6,
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: AppSpacing.space16),
                ],
                // Requirements section.
                if (job.requirements != null &&
                    job.requirements!.isNotEmpty) ...[
                  Container(
                    width: double.infinity,
                    padding:
                        const EdgeInsets.all(AppSpacing.cardPadding),
                    decoration: BoxDecoration(
                      color: AppColors.cardBg,
                      borderRadius: BorderRadius.circular(
                          AppSpacing.cardRadius),
                      boxShadow: AppShadows.sm,
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'Requirements',
                          style: AppTextStyles.headline.copyWith(
                            fontSize: 16,
                          ),
                        ),
                        const SizedBox(height: AppSpacing.space8),
                        ...job.requirements!.map(
                          (req) => Padding(
                            padding:
                                const EdgeInsets.only(bottom: 8),
                            child: Row(
                              crossAxisAlignment:
                                  CrossAxisAlignment.start,
                              children: [
                                Padding(
                                  padding:
                                      const EdgeInsets.only(top: 7),
                                  child: Container(
                                    width: 6,
                                    height: 6,
                                    decoration: BoxDecoration(
                                      color: accentColor,
                                      shape: BoxShape.circle,
                                    ),
                                  ),
                                ),
                                const SizedBox(width: 12),
                                Expanded(
                                  child: Text(
                                    req,
                                    style: AppTextStyles.subheadline
                                        .copyWith(
                                      color:
                                          AppColors.textSecondary,
                                      fontSize: 14,
                                      height: 1.5,
                                    ),
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ],
            ),
          ),
        ),
        // Apply button fixed at bottom.
        if (onApply != null)
          Container(
            padding: EdgeInsets.only(
              left: 20,
              right: 20,
              top: 12,
              bottom: 12 + MediaQuery.of(context).padding.bottom,
            ),
            decoration: BoxDecoration(
              color: AppColors.cardBg,
              border: const Border(
                top: BorderSide(color: AppColors.border, width: 1),
              ),
              boxShadow: AppShadows.nav,
            ),
            child: SizedBox(
              width: double.infinity,
              child: FilledButton.icon(
                onPressed: onApply,
                icon: const Icon(Icons.send, size: 18),
                label: const Text('Apply Now'),
                style: FilledButton.styleFrom(
                  backgroundColor: accentColor,
                  foregroundColor: Colors.white,
                  padding: const EdgeInsets.symmetric(vertical: 14),
                  shape: RoundedRectangleBorder(
                    borderRadius:
                        BorderRadius.circular(AppSpacing.buttonRadius),
                  ),
                ),
              ),
            ),
          ),
      ],
    );
  }
}

class _DetailChip extends StatelessWidget {
  final IconData icon;
  final String label;

  const _DetailChip({required this.icon, required this.label});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      decoration: BoxDecoration(
        color: AppColors.scaffoldBg,
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: AppColors.border),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 14, color: AppColors.textTertiary),
          const SizedBox(width: 6),
          Text(
            label,
            style: AppTextStyles.footnote.copyWith(
              color: AppColors.textSecondary,
            ),
          ),
        ],
      ),
    );
  }
}
