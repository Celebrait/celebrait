// scripts/debug-card-prompts.ts
//
// One-off debugging tool: print the EXACT resolved prompts that went
// to Gemini for a given cardId.
//
// Usage:
//   npx tsx scripts/debug-card-prompts.ts <cardId>
//
// Why this exists: generation_log captures metadata (provider, model,
// cost, duration, template id+version) but NOT the rendered prompt
// text. When a card comes out poorly, you need the text. This script
// replays what the resolver did at gen time, using the card's stored
// conversationData and the active prompt templates today.
//
// Caveat: if the active template version has changed since the card
// was generated, this prints what would happen NOW, not what was
// actually sent then. generation_log stores templateId+templateVersion
// so we use those — but if the template ROW has been edited in place
// (vs versioned), the body could differ.

import 'dotenv/config';
import { eq, and, desc } from 'drizzle-orm';
import { db } from '../server/db';
import {
  cards,
  photos,
  promptTemplates,
  generationLog,
  type CardDraftState,
  deriveDefaultFrontText,
} from '../shared/schema';
import {
  resolveFrontScenePrompt,
  resolveInsideWritePrompt,
  resolveInsideBlankPrompt,
} from '../server/prompts/resolver';
import { resolveStyleDescription } from '../shared/style-descriptions';

async function main() {
  const cardId = parseInt(process.argv[2] ?? '', 10);
  if (!Number.isFinite(cardId)) {
    console.error('Usage: tsx scripts/debug-card-prompts.ts <cardId>');
    process.exit(1);
  }

  // Card row + draft state
  const cardRows = await db
    .select()
    .from(cards)
    .where(eq(cards.id, cardId))
    .limit(1);
  const card = cardRows[0];
  if (!card) {
    console.error(`Card ${cardId} not found`);
    process.exit(1);
  }
  const state = card.conversationData as CardDraftState | null;
  if (!state || state.version !== 1) {
    console.error(`Card ${cardId} has no v1 draft state — can't replay`);
    process.exit(1);
  }

  // generation_log rows for this card, newest first
  const genLogs = await db
    .select()
    .from(generationLog)
    .where(eq(generationLog.cardId, cardId))
    .orderBy(desc(generationLog.createdAt));

  // Build the vars the same way background-generator does
  const photoIds = state.photos?.photoIds ?? [];
  const photoRows = photoIds.length
    ? await db.select().from(photos).where(eq(photos.id, photoIds[0]!))
    : [];
  const photoCount = photoIds.length;
  const photoMode = state.photos?.mode ?? 'one_person';
  const artStyle = resolveStyleDescription(
    state.style?.mode,
    state.style?.custom,
  );
  const cardText = buildCardText(state);
  const includeText = cardText.length > 0;

  // Resolve front-scene prompt
  const resolvedFront = await resolveFrontScenePrompt({
    scenePrompt: state.scene?.description ?? '',
    userArtStyle: artStyle,
    includeText,
    cardText,
    photoMode,
    photoCount,
  });

  // Resolve inside prompt (write or blank, depending on mode)
  const insideMode = state.inside?.mode;
  const resolvedInside =
    insideMode === 'write'
      ? await resolveInsideWritePrompt({
          insideText: buildInsideText(state),
          artStyle,
        })
      : insideMode === 'blank'
        ? await resolveInsideBlankPrompt({
            insideText: '',
            artStyle,
          })
        : null;

  // ── Output ──────────────────────────────────────────────────────────
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`CARD ${cardId} — DEBUG PROMPTS`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log();
  console.log('USER INPUTS');
  console.log('───────────');
  console.log(`Recipient:     ${state.recipient?.name ?? '(none)'}`);
  console.log(`Occasion:      ${state.recipient?.occasion ?? '(none)'}`);
  console.log(
    `Photo mode:    ${photoMode}  (${photoCount} photo${photoCount === 1 ? '' : 's'})`,
  );
  console.log(`Style mode:    ${state.style?.mode ?? '(none)'}`);
  if (state.style?.custom) {
    console.log(`Style custom:  ${state.style.custom}`);
  }
  console.log(`Resolved style: ${artStyle}`);
  console.log(`Scene:         ${state.scene?.description ?? '(none)'}`);
  console.log(`Front text:    ${cardText || '(empty — no text on card)'}`);
  console.log(`Inside mode:   ${insideMode ?? '(none)'}`);
  if (insideMode === 'write') {
    console.log(`Inside text:`);
    console.log(indent(buildInsideText(state), '  '));
  }
  console.log();

  console.log('GENERATION LOG (newest first)');
  console.log('─────────────────────────────');
  if (genLogs.length === 0) {
    console.log('  (no log entries — card never generated?)');
  } else {
    for (const g of genLogs) {
      const ok = g.success ? '✓' : '✗';
      const cost = (g.costCentsX100 / 100 / 100).toFixed(3);
      const tpl =
        g.templateId !== null ? `tpl=${g.templateId}/v${g.templateVersion}` : 'no-tpl';
      console.log(
        `  ${ok} ${g.slot.padEnd(20)} ${g.provider.padEnd(8)} ${tpl.padEnd(14)} ` +
          `${g.durationMs}ms  $${cost}  ${g.errorCode ?? ''}`,
      );
    }
  }
  console.log();

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('FRONT PROMPT (resolved against current active template)');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(
    `provider=${resolvedFront.provider ?? 'openai(fallback)'}  ` +
      `quality=${resolvedFront.quality ?? 'high(fallback)'}  ` +
      `variant=${resolvedFront.variant ?? 'null'}  ` +
      `templateId=${resolvedFront.templateId} v=${resolvedFront.templateVersion}  ` +
      `source=${resolvedFront.source}`,
  );
  console.log();
  console.log(resolvedFront.text);
  console.log();

  if (resolvedInside) {
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`INSIDE PROMPT (${insideMode}, resolved against current active)`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(
      `provider=${resolvedInside.provider ?? 'openai(fallback)'}  ` +
        `quality=${resolvedInside.quality ?? 'high(fallback)'}  ` +
        `templateId=${resolvedInside.templateId} v=${resolvedInside.templateVersion}  ` +
        `source=${resolvedInside.source}`,
    );
    console.log();
    console.log(resolvedInside.text);
    console.log();
  }

  // Heads-up if the active template version differs from what was
  // logged — means the prompt above is NOT what was actually sent.
  for (const g of genLogs) {
    if (g.slot === 'front_scene' && g.templateId !== null) {
      if (
        g.templateId !== resolvedFront.templateId ||
        g.templateVersion !== resolvedFront.templateVersion
      ) {
        console.warn(
          `⚠  At gen time, front used templateId=${g.templateId} v=${g.templateVersion}; ` +
            `current active is ${resolvedFront.templateId} v=${resolvedFront.templateVersion}. ` +
            `Pull the historical template body if you need the exact prompt that was sent.`,
        );
        // Pull the historical template body for inspection
        const histRows = await db
          .select()
          .from(promptTemplates)
          .where(
            and(
              eq(promptTemplates.id, g.templateId),
              eq(promptTemplates.version, g.templateVersion!),
            ),
          )
          .limit(1);
        if (histRows[0]) {
          console.log();
          console.log('HISTORICAL FRONT TEMPLATE BODY (raw, unrendered)');
          console.log('────────────────────────────────────────────────');
          console.log(histRows[0].templateText);
          console.log();
        }
      }
      break;
    }
  }

  process.exit(0);
}

// ── Helpers — duplicated from server/background-generator.ts so the
//    script doesn't depend on the server's private helpers. Keep these
//    in sync if buildCardText / buildInsideText change.

function buildCardText(state: CardDraftState): string {
  const userText = state.front?.text?.trim();
  if (userText) return userText;
  return deriveDefaultFrontText(state);
}

function buildInsideText(state: CardDraftState): string {
  const write = state.inside?.write ?? {};
  const parts: string[] = [];
  if (write.salutation?.trim()) parts.push(write.salutation.trim());
  if (write.message?.trim()) parts.push(write.message.trim());
  if (write.signoff?.trim()) parts.push(write.signoff.trim());
  return parts.join('\n\n');
}

function indent(text: string, prefix: string): string {
  return text
    .split('\n')
    .map((l) => prefix + l)
    .join('\n');
}

main().catch((err) => {
  console.error('Failed:', err);
  process.exit(1);
});
