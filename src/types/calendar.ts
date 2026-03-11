export interface ConnectedCalendarAccount {
  id: string;
  user_id: string;
  provider: 'google' | 'microsoft';
  provider_account_id: string;
  provider_account_email: string;
  display_name: string | null;
  avatar_url: string | null;
  is_connected: boolean;
  last_synced_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ExternalCalendar {
  id: string;
  user_id: string;
  connected_account_id: string;
  provider_calendar_id: string;
  name: string;
  description: string | null;
  color: string | null;
  is_enabled: boolean;
  is_primary: boolean;
  created_at: string;
  updated_at: string;
}

export interface ExternalCalendarEvent {
  id: string;
  user_id: string;
  connected_account_id: string;
  external_calendar_id: string;
  provider_event_id: string;
  title: string;
  description: string | null;
  start_at: string;  // ISO 8601 UTC
  end_at: string;    // ISO 8601 UTC
  is_all_day: boolean;
  location: string | null;
  status: 'confirmed' | 'tentative' | 'cancelled';
  last_synced_at: string;
  created_at: string;
  updated_at: string;
}
