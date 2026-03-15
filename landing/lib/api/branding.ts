const API_BASE = '/api/v1';

export async function uploadLogo(file: File): Promise<{ logoUrl: string }> {
  const token = localStorage.getItem('access_token');
  const formData = new FormData();
  formData.append('file', file);
  const res = await fetch(`${API_BASE}/branding/logo-upload`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}` },
    body: formData,
  });
  if (!res.ok) throw new Error('Logo upload failed');
  return res.json();
}

export async function updateBranding(data: {
  primaryColor?: string;
  accentColor?: string;
  backgroundColor?: string;
  instituteName?: string;
  tagline?: string;
}): Promise<void> {
  const token = localStorage.getItem('access_token');
  const body: Record<string, string> = {};
  if (data.primaryColor) body.primary_color = data.primaryColor;
  if (data.accentColor) body.accent_color = data.accentColor;
  if (data.backgroundColor) body.background_color = data.backgroundColor;
  if (data.instituteName) body.institute_name = data.instituteName;
  if (data.tagline) body.tagline = data.tagline;
  const res = await fetch(`${API_BASE}/branding`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error('Branding update failed');
}
