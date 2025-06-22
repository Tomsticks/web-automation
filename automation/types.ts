
export interface AutomationConfig {
  url: string;
  email: string;
  timeout: number;
  retryAttempts: number;
  scrollDelay: number;
  diagnosticMode: boolean;
}

export interface SelectorStrategy {
  primary: string;
  fallbacks: string[];
  context?: string;
  waitFor?: 'visible' | 'attached' | 'detached';
  timeout?:number
}

export interface AutomationResult {
  success: boolean;
  timestamp: string;
  url: string;
  executionTime: number;
  strategiesUsed: string[];
  errors: string[];
  diagnostics: DiagnosticInfo;
}

export interface DiagnosticInfo {
  pageTitle: string;
  popupDetected: boolean;
  iframeCount: number;
  shadowDOMDetected: boolean;
  scrollLocked: boolean;
  modalActive: boolean;
  finalScreenshot?: string;
}

export interface PopupStrategy {
  name: string;
  selectors: SelectorStrategy;
  action: 'click' | 'fill' | 'wait';
  value?: string;
}
