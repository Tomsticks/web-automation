
import { Page } from '@playwright/test';
import { DiagnosticInfo } from './types';

export class DiagnosticEngine {
  constructor(private page: Page) {}

  async collectDiagnostics(): Promise<DiagnosticInfo> {
    const diagnostics: DiagnosticInfo = {
      pageTitle: '',
      popupDetected: false,
      iframeCount: 0,
      shadowDOMDetected: false,
      scrollLocked: false,
      modalActive: false
    };

    try {
      // Basic page information
      diagnostics.pageTitle = await this.page.title();

      // Check for iframes
      diagnostics.iframeCount = await this.page.locator('iframe').count();

      // Check for scroll lock (common popup indicator)
      diagnostics.scrollLocked = await this.page.evaluate(() => {
        const body = document.body;
        const html = document.documentElement;
        return body.style.overflow === 'hidden' || 
               html.style.overflow === 'hidden' ||
               body.classList.contains('no-scroll') ||
               html.classList.contains('no-scroll');
      });

      // Check for active modals/popups
      diagnostics.modalActive = await this.detectActiveModal();

      // Check for shadow DOM
      diagnostics.shadowDOMDetected = await this.page.evaluate(() => {
        const elements = document.querySelectorAll('*');
        for (const element of elements) {
          if (element.shadowRoot) return true;
        }
        return false;
      });

      // Popup detection using common patterns
      diagnostics.popupDetected = await this.detectPopups();

    } catch (error) {
      console.warn('Diagnostic collection failed:', error);
    }

    return diagnostics;
  }

  private async detectActiveModal(): Promise<boolean> {
    const modalSelectors = [
      '[role="dialog"]',
      '.modal',
      '.popup',
      '.overlay',
      '[data-modal]',
      '.newsletter-popup',
      '.email-signup-modal'
    ];

    for (const selector of modalSelectors) {
      try {
        const element = await this.page.locator(selector).first();
        if (await element.isVisible()) {
          return true;
        }
      } catch {
        continue;
      }
    }
    return false;
  }

  private async detectPopups(): Promise<boolean> {
    // Check for common popup indicators
    const popupIndicators = [
      '.popup-overlay',
      '.modal-backdrop',
      '[data-popup]',
      '.newsletter-popup',
      '.email-capture'
    ];

    for (const selector of popupIndicators) {
      try {
        const count = await this.page.locator(selector).count();
        if (count > 0) return true;
      } catch {
        continue;
      }
    }
    return false;
  }

  
}
