import type { FlejeCustomization, MateConfiguration } from './customizer';

export type WizardStep = 'welcome' | 'product_selection' | 'customizer' | 'summary' | 'checkout' | 'success' | 'profile';

export interface UserData {
  id?: string;
  isGuest?: boolean;
  name: string;
  email: string;
  phone: string;
  company?: string;
}

export interface SavedDesignItem {
  id: string;
  user_id?: string;
  title: string;
  configuration: MateConfiguration;
  fleje_config: FlejeCustomization;
  status: 'draft' | 'submitted';
  created_at: string;
}
