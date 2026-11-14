// Listen to a chapter (DESIGN.md §8 Listen): the text that is read aloud and where each
// verse begins in the recording (pure, so it can be tested; shared by server and browser).

/** The natural voice: ElevenLabs Flash (half the price of Multilingual), a small voice-quality mp3. */
export const NARRATION_MODEL = "eleven_flash_v2_5";
export const NARRATION_FORMAT = "mp3_22050_32";
/** ElevenLabs' standard "Rachel" voice, until NARRATION_VOICE_ID chooses another. */
export const DEFAULT_VOICE_ID = "21m00Tcm4TlvDq8ikWAM";

export const SPEEDS = [0.75, 1, 1.25, 1.5] as const;

/** The chapter as one text to read (verse numbers aren't read), and where each verse starts in it. */
export function narrationText(verses: string[]): { text: string; offsets: number[] } {
  const offsets: number[] = [];
  let text = "";
  for (const v of verses) {
    if (text) text += " ";
    offsets.push(text.length);
    text += v.trim();
  }
  return { text, offsets };
}

/**
 * Seconds into the recording where each verse begins, from the time ElevenLabs gives each
 * character. If the timings are shorter than the text (they shouldn't be), the last known
 * time is used, so a verse is never placed after the end.
 */
export function verseStarts(offsets: number[], characterStartTimes: number[]): number[] {
  let last = 0;
  return offsets.map((o) => {
    const t = characterStartTimes[Math.min(o, characterStartTimes.length - 1)];
    last = Number.isFinite(t) ? Math.max(last, t) : last;
    return Math.round(last * 100) / 100;
  });
}

/** The verse (0-based) playing at `seconds`. */
export function verseAtTime(starts: number[], seconds: number): number {
  let i = 0;
  while (i + 1 < starts.length && starts[i + 1] <= seconds + 0.05) i++;
  return i;
}
