export type WizardStep = 'welcome' | 'product_selection' | 'customizer' | 'summary' | 'success' | 'profile';

export interface UserData {
  id?: string;
  name: string;
  email: string;
  phone: string;
  company?: string;
}

export interface SavedDesignItem {
  id: string;
  user_id?: string;
  title: string;
  configuration: any;
  fleje_config: any;
  status: 'draft' | 'submitted';
  created_at: string;
}
