export default function PrivacyPolicyPage() {
  return (
    <div style={{ maxWidth: 800, margin: '0 auto', padding: '40px 20px', fontFamily: 'system-ui, sans-serif', color: '#333', lineHeight: 1.7 }}>
      <h1 style={{ fontSize: 28, marginBottom: 8 }}>Privacy Policy</h1>
      <p style={{ color: '#666', marginBottom: 32 }}>Last updated: March 12, 2026</p>

      <p>
        Zensbot (&quot;we&quot;, &quot;our&quot;, or &quot;us&quot;) operates the Zensbot LMS mobile application and the
        ict.zensbot.site website (collectively, the &quot;Service&quot;). This Privacy Policy explains how we
        collect, use, and protect your information when you use our Service.
      </p>

      <h2 style={{ fontSize: 22, marginTop: 32 }}>1. Information We Collect</h2>

      <h3 style={{ fontSize: 18, marginTop: 20 }}>Account Information</h3>
      <p>When your institute creates an account for you, we store:</p>
      <ul>
        <li>Full name</li>
        <li>Email address</li>
        <li>Role (student, teacher, course creator, or admin)</li>
        <li>Institute affiliation</li>
      </ul>

      <h3 style={{ fontSize: 18, marginTop: 20 }}>Usage Data</h3>
      <p>We automatically collect:</p>
      <ul>
        <li>Device information (device type, operating system)</li>
        <li>Login timestamps and session data</li>
        <li>Course progress, quiz attempts, and scores</li>
        <li>Content interactions (lectures viewed, materials accessed)</li>
      </ul>

      <h2 style={{ fontSize: 22, marginTop: 32 }}>2. How We Use Your Information</h2>
      <ul>
        <li>To provide and maintain the learning management service</li>
        <li>To authenticate your identity and manage sessions</li>
        <li>To track course progress, quiz results, and certifications</li>
        <li>To enable communication between students, teachers, and admins</li>
        <li>To generate certificates of completion</li>
        <li>To improve the Service and fix bugs</li>
      </ul>

      <h2 style={{ fontSize: 22, marginTop: 32 }}>3. Data Storage and Security</h2>
      <p>
        Your data is stored on secure cloud infrastructure (AWS) with encryption in transit (TLS/SSL)
        and at rest. Authentication tokens are stored securely on your device using encrypted storage.
        We implement industry-standard security measures including JWT-based authentication, rate
        limiting, and session management.
      </p>

      <h2 style={{ fontSize: 22, marginTop: 32 }}>4. Data Sharing</h2>
      <p>We do not sell your personal information. We may share data with:</p>
      <ul>
        <li><strong>Your Institute:</strong> Admins and teachers at your institute can view your enrollment, progress, and quiz scores as part of the educational service.</li>
        <li><strong>Service Providers:</strong> We use third-party services for hosting (AWS), video delivery (Bunny.net), and error monitoring (Sentry) that may process data on our behalf.</li>
        <li><strong>Legal Requirements:</strong> We may disclose data if required by law or to protect our rights.</li>
      </ul>

      <h2 style={{ fontSize: 22, marginTop: 32 }}>5. Data Retention</h2>
      <p>
        We retain your account data for as long as your institute account is active. When an account
        is deleted, personal data is soft-deleted and permanently removed after 90 days. Quiz
        attempts, certificates, and course completion records may be retained for academic record
        purposes.
      </p>

      <h2 style={{ fontSize: 22, marginTop: 32 }}>6. Your Rights</h2>
      <p>You have the right to:</p>
      <ul>
        <li>Access the personal data we hold about you</li>
        <li>Request correction of inaccurate data</li>
        <li>Request deletion of your account and data</li>
        <li>Export your data in a portable format</li>
      </ul>
      <p>To exercise these rights, contact your institute administrator or email us directly.</p>

      <h2 style={{ fontSize: 22, marginTop: 32 }}>7. Children&apos;s Privacy</h2>
      <p>
        Our Service is intended for use by students aged 13 and above. We do not knowingly collect
        personal information from children under 13. If you believe a child under 13 has provided us
        with personal data, please contact us so we can delete it.
      </p>

      <h2 style={{ fontSize: 22, marginTop: 32 }}>8. Changes to This Policy</h2>
      <p>
        We may update this Privacy Policy from time to time. We will notify users of significant
        changes through the Service or by email. Continued use of the Service after changes
        constitutes acceptance of the updated policy.
      </p>

      <h2 style={{ fontSize: 22, marginTop: 32 }}>9. Contact Us</h2>
      <p>
        If you have questions about this Privacy Policy, contact us at:
      </p>
      <ul>
        <li>Email: <a href="mailto:support@zensbot.com" style={{ color: '#2563eb' }}>support@zensbot.com</a></li>
        <li>Website: <a href="https://zensbot.com" style={{ color: '#2563eb' }}>https://zensbot.com</a></li>
      </ul>

      <div style={{ marginTop: 48, paddingTop: 24, borderTop: '1px solid #e5e7eb', color: '#999', fontSize: 14 }}>
        <p>&copy; {new Date().getFullYear()} Zensbot. All rights reserved.</p>
      </div>
    </div>
  );
}
