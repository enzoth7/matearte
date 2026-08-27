import type { FlejeCustomization, MateConfiguration } from './customizer';

export type WizardStep = 'welcome' | 'access' | 'product_selection' | 'customizer' | 'summary' | 'checkout' | 'success' | 'profile';

export interface UserData {
  id?: string;
  isGuest?: boolean;
  name: string;
  email: string;
  phone: string;
  company?: string;
  birthDate?: string;
  countryCode?: string;
  department?: string;
  city?: string;
  addressLine1?: string;
  postalCode?: string;
  avatarPath?: string;
  avatarUrl?: string;
  profileComplete?: boolean;
}

export interface SavedDesignItem {
  id: string;
  user_id?: string;
  client_draft_id: string;
  design_code: string;
  title: string;
  configuration: MateConfiguration;
  fleje_config: FlejeCustomization;
  status: 'draft' | 'saved' | 'archived';
  created_at: string;
  updated_at: string;
}
