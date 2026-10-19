# Decibel

**English** · [Română](README.ro.md) · [Français](README.fr.md) · [Italiano](README.it.md) · [Español](README.es.md) · [Português](README.pt.md) · [Deutsch](README.de.md) · [Magyar](README.hu.md)

**Version:** 1.0.0 · **Last updated:** 2026-10-14

Sound level meter, spectrum analyzer and indicative hearing test, in a single HTML file. It measures sound level in real time with A, C and Z weightings (IEC 61672, IIR filters), Fast/Slow time constants, LAeq over a chosen interval, Lmax/Lmin, L10/L50/L90, a histogram, SEL and noise dose against a chosen limit. It displays the spectrum in 1/3-octave and 1/1-octave bands (20 Hz–20 kHz) and a linear FFT, with the peak frequency and a spectrogram. It includes calibration with a dB offset, a pink/white noise and 1 kHz sine generator, a separate audiometric test and a local session log. It complements the sound apps FrequencyLaboratory, generator-frecvente, Aurora, CalmWaves and ASMR.

![screenshot](screenshot.png)

**Live app:** https://chiuta.github.io/apps/Decibel/

## How to use

1. **Measurement:** press "Pornește microfonul" (Start microphone; the browser asks for permission), choose the weighting and the time constant. "Marchează eveniment" (Mark event, or the M key) puts a marker on the chart. "Analizează fișier audio…" (Analyze audio file…) and "Încarcă exemplu" (Load example) use the same engine, without a microphone.
2. **Calibration:** without calibration, values are in dBFS (not dB SPL). Enter a manual offset or use the wizard: it measures a calibrator or a reference sound level meter for 10 s, and you enter the reference level. The offset is saved per profile (microphone and browser) and applied retroactively.
3. **Spectrum:** 1/3- or 1/1-octave bands, linear FFT (Hann window), peak with parabolic interpolation, spectrogram; NR curves only for calibrated values.
4. **Audiogram:** pure tones 250 Hz–8 kHz, simplified Hughson–Westlake method. Without calibrating the headphones against a sound level meter, the result is only a relative threshold, not dB HL.
5. **Log:** sessions (date, duration, LAeq, Lmax, location) are saved locally; export to CSV, JSON, `.fff.json` and printing (PDF from the print dialog). The "Șterge tot" (Delete all) button deletes all local data.

## What it does NOT do, and limits

- **It is not a certified sound level meter.** Phone/laptop microphones are not calibrated, have an uneven frequency response and compression, and saturate above ~90–100 dB. The measurements are NOT legally valid and do NOT replace the noise exposure assessment required by occupational safety rules; check the applicable legislation.
- The dose uses indicative limits (NIOSH 85 dB(A)/8 h with a 3 dB exchange rate, the EU recommendations of 80/85/87 dB(A) from Directive 2003/10/EC, or your own values); no legal values are invented.
- The displayed uncertainty is indicative (±3/±4/±5 dB depending on the calibration method, with +5 dB outside 35–90 dB).
- Checking the filters against Class 2 tolerances is done for the filters only; the tables and tolerances were transcribed from memory and may contain small errors. Above ~8 kHz the bilinear filters deviate from the analog shape.
- Lmax/Lmin/L10/L50/L90 exclude the first 0.5 s (Fast) or 3 s (Slow). Sessions shorter than 5 s are not saved automatically.
- No NC curves (unreliable values); NR is based on ISO R 1996 coefficients, transcribed from memory.
- **The audiogram is not a medical test** and provides no clinical interpretation. The default RETSPL values (TDH-39) are editable and were transcribed from memory. For hearing problems, consult an ENT doctor or an audiologist.
- File mode uses the first channel, up to 60 minutes. Encrypted bundles are not accepted.
- The browser may ignore the disabling of AGC/echo cancellation/noise suppression; the app checks and warns.

## Privacy

It runs locally and sends nothing. Sound is not recorded and does not leave the page; it is processed in real time. Settings, calibration profiles and the log are kept only in `localStorage` (prefix `fff.decibel.`), in your browser.

## Supported formats

Audio files: WAV PCM 8/16/24/32-bit and float 32/64 (own parser), other formats through the browser's decoder. Import/export: `.fff.json`; CSV and JSON export.

## Technical

- A single `index.html`, no external libraries, no network. Standard strict CSP (`default-src 'none'`, script with a SHA-256 hash recomputed with `fff-kit/lib/csp.mjs`, `connect-src 'none'`); no CSP adaptations were needed.
- Level: dBFS RMS (a full-scale sine = −3.01 dBFS); SPL = dBFS + offset, applied at display time.
- Weightings: bilinear biquads from the IEC 61672 poles, normalized to 0 dB at 1 kHz. Time: exponential averaging of squares (125 ms / 1 s).
- Spectrum: own radix-2 FFT, IEC 61260 base-10 bands. Microphone: `getUserMedia` + `ScriptProcessorNode` (AudioWorklet avoided because of the CSP).
- Tests: `node tests/test.mjs` (Playwright, microphone simulated with generated WAV files: 1 kHz sine, pink noise, impulses; axe, overflow at 360×740 and 1280×800, keyboard).

## Third parties

No third-party library or resource.

## Translations

The default language is Romanian. The translations into French, Italian, Spanish, Portuguese, Hungarian and German are automatic and have not been checked by native speakers.

## License

License: MIT — see the `LICENSE` file in the repository root

## History

- 1.0.0 — 2026-10-14: first version
