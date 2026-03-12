import { Effect } from "effect";
import { getMockHtmlFilePath, getMockImageFilePath, getOutImageFilePath } from "../mocks/mock-utils";
import { MockScrapeClient } from "../mocks/mock-scrape-client";
import { RUN_MODE } from "../config/run-mode";
import { trackImageUsed } from "./image-cache";
import { processImage } from "./image-processor";

export { cleanupUnusedImages } from "./image-cache";

export interface ScrapeClient {
  get(url: string): Effect.Effect<string, Error>;
  getImage(url: string): Effect.Effect<Uint8Array, Error>;
}

export function getScrapeClient(): ScrapeClient {
  if (RUN_MODE === "mock") {
    console.log("Using MockScrapeClient (RUN_MODE=mock)");
    return new MockScrapeClient();
  } else {
    console.log(`Using ScrapeClientImpl (RUN_MODE=${RUN_MODE})`);
    return new ScrapeClientImpl();
  }
}

export class ScrapeClientImpl implements ScrapeClient {
  private static readonly DEFAULT_DELAY_MS = 1000;
  private static readonly USER_AGENT = "SeattleIndieClub/1.0 (+https://seattleindie.club)";

  private lastRequestTime = 0;
  private readonly delayMs: number;

  constructor(delayMs: number = ScrapeClientImpl.DEFAULT_DELAY_MS) {
    this.delayMs = delayMs;
    if (RUN_MODE === "update_mocks") {
      console.log("update_mocks mode enabled - will save HTML responses to mocks/html folder");
    }
  }

  private async enforceDelay(): Promise<void> {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;

    if (timeSinceLastRequest < this.delayMs) {
      const delayNeeded = this.delayMs - timeSinceLastRequest;
      await new Promise(resolve => setTimeout(resolve, delayNeeded));
    }

    this.lastRequestTime = Date.now();
  }

  private async saveMock(url: string, html: string): Promise<void> {
    const filePath = getMockHtmlFilePath(url);

    await Bun.write(filePath, html);
    console.log(`Saved mock for ${url} to ${filePath}`);
  }

  private async saveImageMock(url: string, data: Uint8Array): Promise<void> {
    const filePath = getMockImageFilePath(url);

    await Bun.write(filePath, data);
    console.log(`Saved image mock for ${url} to ${filePath}`);
  }

  private async saveOutImage(url: string, data: Uint8Array): Promise<void> {
    const filePath = getOutImageFilePath(url);

    await Bun.write(filePath, data);
    console.log(`Saved output image for ${url} to ${filePath}`);
  }

  get(url: string): Effect.Effect<string, Error> {
    return Effect.tryPromise({
      try: async () => {
        await this.enforceDelay();

        const response = await fetch(url, {
          headers: {
            "User-Agent": ScrapeClientImpl.USER_AGENT,
          },
        });

        if (!response.ok) {
          throw new Error(`Request failed: ${response.status} ${response.statusText}`);
        }

        const html = await response.text();

        if (RUN_MODE === "update_mocks") {
          await this.saveMock(url, html);
        }

        return html;
      },
      catch: (error): Error => {
        return error instanceof Error
          ? error
          : new Error(String(error));
      },
    });
  }

  getImage(url: string): Effect.Effect<Uint8Array, Error> {
    return Effect.tryPromise({
      try: async () => {
        const outFilePath = getOutImageFilePath(url);

        // Track this image as used for cleanup
        trackImageUsed(outFilePath);

        // In update_mocks mode, always download so we save the mock file
        if (RUN_MODE !== "update_mocks") {
          // Check if image already exists in out/images (cache hit)
          const existingFile = Bun.file(outFilePath);
          if (await existingFile.exists()) {
            console.log(`Using cached image: ${outFilePath}`);
            const buffer = await existingFile.arrayBuffer();
            return new Uint8Array(buffer);
          }
        }

        // Cache miss (or update_mocks mode) - download the image
        await this.enforceDelay();

        const response = await fetch(url, {
          headers: {
            "User-Agent": ScrapeClientImpl.USER_AGENT,
          },
        });

        if (!response.ok) {
          throw new Error(`Request failed: ${response.status} ${response.statusText}`);
        }

        const buffer = await response.arrayBuffer();
        const data = new Uint8Array(buffer);

        if (RUN_MODE === "update_mocks") {
          // Save original (unprocessed) image to mocks
          await this.saveImageMock(url, data);
        }

        // Process image (resize + convert to WebP) before saving to out/
        const processed = await processImage(data);
        await this.saveOutImage(url, processed);

        return processed;
      },
      catch: (error): Error => {
        return error instanceof Error
          ? error
          : new Error(String(error));
      },
    });
  }
}
