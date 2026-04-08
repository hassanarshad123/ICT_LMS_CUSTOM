/**
 * Feature flags for the landing app.
 *
 * These are read from public environment variables at build time so they
 * can be toggled from the Vercel dashboard without a code change.
 *
 * IMPORTANT: Because these are `NEXT_PUBLIC_*` vars, they are inlined into
 * the client bundle at build time. Flipping the flag in Vercel triggers a
 * redeploy (~30 seconds) — this is intentional and acts as a "safe" rollback
 * path during the launch window.
 */

/**
 * Master switch for the personalized onboarding animation that replaces the
 * "Setting up your LMS..." spinner. When `false`, users see the original
 * spinner (safe fallback). When `true`, they see the animation.
 *
 * Set in Vercel: Dashboard → landing project → Settings → Environment Variables
 * → NEXT_PUBLIC_SHOW_ONBOARDING_ANIMATION = "true" or "false"
 */
export const SHOW_ONBOARDING_ANIMATION =
  process.env.NEXT_PUBLIC_SHOW_ONBOARDING_ANIMATION === 'true';
