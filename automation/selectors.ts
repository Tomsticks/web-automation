
import { Page, Locator } from '@playwright/test';
import { SelectorStrategy } from './types';

export class SelectorEngine {
  constructor(private page: Page) {}

  async findAllElements(strategy: SelectorStrategy): Promise<Locator[]> {
    let locators: Locator[] = [];
    try {
      // Try primary selector first
      const primaryLocators = this.page.locator(strategy.primary);
      if (await primaryLocators.count() > 0) {
        locators = await primaryLocators.all(); // Get all matching locators
      }
    } catch (e) {
      // console.log(`Primary selector '${strategy.primary}' for findAllElements failed:`, e);
    }

    // If primary didn't find any or failed, try fallbacks
    if (locators.length === 0) {
      for (const fallback of strategy.fallbacks) {
        try {
          const fallbackLocators = this.page.locator(fallback);
          if (await fallbackLocators.count() > 0) {
            locators = await fallbackLocators.all(); // Get all matching locators
            break; // Stop after first successful fallback
          }
        } catch (e) {
          // console.log(`Fallback selector '${fallback}' for findAllElements failed:`, e);
        }
      }
    }
    return locators;
  }
  

  
  // Helper to check if an element is ready based on desired state
  private async isElementReady(
    locator: Locator,
    state: 'visible' | 'hidden' | 'attached' | 'detached' = 'visible', // Default to 'visible'
    timeout: number = 5000 // Default timeout for readiness check
  ): Promise<boolean> {
    try {
      // Playwright's waitFor() is the most robust way to check element state.
      // It handles retries internally and is more efficient than polling.
      await locator.waitFor({ state: state, timeout: timeout });
      // If waitFor succeeds, the element is in the desired state.
      return true;
    } catch (e) {
      // If waitFor times out or element is not in the state, it's not ready.
      return false;
    }
  }

  async findElement(strategy: SelectorStrategy): Promise<Locator | null> {
    const selectorsToTry = [strategy.primary, ...(strategy.fallbacks || [])]; // Ensure fallbacks is an array

    for (const selector of selectorsToTry) {
      try {
        const element = this.page.locator(selector).first(); // Always get the first match

        // Use isElementReady with optional waitFor state and timeout from strategy
        const isReady = await this.isElementReady(
          element,
          strategy.waitFor,
          strategy.timeout
        );

        if (isReady) {
          // Additional check: Ensure it's not hidden by display: none or visibility: hidden
          // This complements waitFor('visible') by catching edge cases, though waitFor('visible')
          // typically handles this well.
          const boundingBox = await element.boundingBox();
          if (boundingBox) { // Element has a bounding box, likely visible on screen
            return element;
          } else {
            console.warn(`Element found by '${selector}' but has no bounding box (possibly zero size or not rendered). Trying next.`);
          }
        }
      } catch (error: any) { // Use 'any' for the error type if you're not specifically catching Playwright errors
        console.warn(`Selector failed to locate or become ready: '${selector}' - ${error.message}`);
      }
    }

    return null; // No element found or ready after trying all selectors
  }

  async findInIframes(strategy: SelectorStrategy): Promise<Locator | null> {
    const iframes = await this.page.locator('iframe').all();
    
    for (const iframe of iframes) {
      try {
        const frame = await iframe.contentFrame();
        if (!frame) continue;

        const element = frame.locator(strategy.primary);
        if (await this.isElementReady(element, strategy.waitFor)) {
          return element;
        }

        // Try fallbacks in iframe
        for (const fallback of strategy.fallbacks) {
          const fallbackElement = frame.locator(fallback);
          if (await this.isElementReady(fallbackElement, strategy.waitFor)) {
            return fallbackElement;
          }
        }
      } catch (error) {
        console.warn('Iframe search failed:', error);
      }
    }

    return null;
  }

  async findInShadowDOM(strategy: SelectorStrategy): Promise<any> {
    return await this.page.evaluate((selectorData) => {
      function searchShadowDOM(root: Document | ShadowRoot, selector: string): Element | null {
        // Search in current root
        const element = root.querySelector(selector);
        if (element) return element;

        // Search in shadow roots
        const elementsWithShadow = root.querySelectorAll('*');
        for (const element of elementsWithShadow) {
          if (element.shadowRoot) {
            const found = searchShadowDOM(element.shadowRoot, selector);
            if (found) return found;
          }
        }
        return null;
      }

      // Try primary selector
      let found = searchShadowDOM(document, selectorData.primary);
      if (found) return found;

      // Try fallbacks
      for (const fallback of selectorData.fallbacks) {
        found = searchShadowDOM(document, fallback);
        if (found) return found;
      }

      return null;
    }, strategy);
  }
}
